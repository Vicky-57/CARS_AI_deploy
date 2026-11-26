"""
app/services/document_service.py
────────────────────────────────────────────────────────────────────────
Two cleanly separated document workflows:
  1. Upload Document (`store_uploaded_document`):
     Saves customer/founder files (ID, contracts, vehicle papers, photos, other)
     directly to Google Drive (when connected) or Supabase Storage fallback,
     and records metadata in `customer_documents`. Performs ZERO OCR parsing.

  2. OCR Scan (`scan_document` + `apply_ocr_to_crm`):
     Extracts structured fields from Fahrzeugschein / ID cards / other documents
     using pdfplumber + Claude Vision, shows a preview for confirmation, and
     saves confirmed fields onto lead/project records + contract template
     canonical keys (`client_form_sessions.shared_core`).
────────────────────────────────────────────────────────────────────────
"""
import asyncio
import logging
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

import httpx

from config import settings
from app.services import whatsapp_store as store

logger = logging.getLogger("document_service")

UPLOAD_CATEGORIES = [
    ("id_card", "🪪 ID Card"),
    ("contract", "📝 Contract"),
    ("vehicle_papers", "🚗 Vehicle Papers"),
    ("photos", "📸 Photos"),
    ("other", "📎 Other"),
]

SCAN_DOC_TYPES = [
    ("vehicle", "🚗 Fahrzeugschein"),
    ("id_card", "🪪 ID Card / Pass"),
    ("other", "📄 Other Document"),
]

_CATEGORY_DRIVE_SUBFOLDER = {
    "id_card": "2. Legal Docs",
    "contract": "2. Legal Docs",
    "vehicle_papers": "1. OCR",
    "photos": "1. OCR",
    "other": "2. Legal Docs",
}

_MIME_EXT = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _safe_filename(raw: Optional[str], mime: str) -> str:
    ext = _MIME_EXT.get((mime or "").split(";")[0].strip().lower(), ".bin")
    if raw:
        clean = re.sub(r"[^A-Za-z0-9._-]", "_", raw).strip("_")
        if clean:
            return clean if "." in clean else f"{clean}{ext}"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"doc_{stamp}_{uuid.uuid4().hex[:6]}{ext}"


def _upload_to_supabase_storage(storage_path: str, file_bytes: bytes, mime_type: str) -> Optional[str]:
    """Upload bytes to public Supabase Storage bucket `customer-documents`; returns public URL or None."""
    base = settings.SUPABASE_URL.rstrip("/")
    key = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_PUBLISHABLE_KEY
    url = f"{base}/storage/v1/object/customer-documents/{storage_path}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": mime_type or "application/octet-stream",
        "x-upsert": "true",
    }
    try:
        res = httpx.post(url, headers=headers, content=file_bytes, timeout=30.0)
        res.raise_for_status()
        return f"{base}/storage/v1/object/public/customer-documents/{storage_path}"
    except Exception as e:
        logger.warning(f"Supabase storage upload failed for {storage_path}: {e}")
        return None


async def store_uploaded_document(
    file_bytes: bytes,
    filename: Optional[str],
    mime_type: str,
    customer: Dict,
    category: str = "other",
    source: str = "WHATSAPP_UPLOAD",
    notes: str = "",
) -> Dict:
    """
    Store a personalized document against a customer record with ZERO OCR parsing.
    Prefers Google Drive when connected; falls back cleanly to Supabase Storage.
    """
    fname = _safe_filename(filename, mime_type)
    cust_name = customer.get("name") or "Customer"
    cust_phone = customer.get("phone") or ""
    cust_email = customer.get("email") or ""
    lead_id = customer.get("lead_id")
    project_id = customer.get("project_id")
    ref_id = str(project_id or lead_id or uuid.uuid4())[:8]

    drive_file_id = None
    drive_url = None
    storage_bucket = None
    storage_path = None
    file_url = None

    if not store.MEMORY:
        # 1. Try Google Drive if OAuth is connected
        try:
            from app.services.google_service import is_connected
            if is_connected():
                from app.services.gdrive_service import create_customer_folder_structure, upload_file_to_drive_folder
                struct = create_customer_folder_structure(cust_name, ref_id)
                sub = _CATEGORY_DRIVE_SUBFOLDER.get(category, "2. Legal Docs")
                parent_id = (
                    struct["ocr_folder_id"] if sub == "1. OCR"
                    else struct["signed_docs_folder_id"] if sub == "3. Signed Docs"
                    else struct["legal_docs_folder_id"]
                )
                up = await asyncio.to_thread(upload_file_to_drive_folder, parent_id, fname, file_bytes, mime_type or "application/octet-stream")
                drive_file_id = up.get("file_id")
                drive_url = up.get("webViewLink")
                file_url = drive_url
        except Exception as e:
            logger.warning(f"Google Drive upload failed, falling back to Supabase Storage: {e}")

        # 2. Fallback to Supabase Storage bucket `customer-documents`
        if not file_url:
            clean_cust = re.sub(r"[^A-Za-z0-9_-]", "_", cust_name).strip("_") or "client"
            storage_path = f"{clean_cust}_{ref_id}/{category}/{fname}"
            pub_url = await asyncio.to_thread(_upload_to_supabase_storage, storage_path, file_bytes, mime_type)
            if pub_url:
                storage_bucket = "customer-documents"
                file_url = pub_url

    row = store.save_customer_document({
        "lead_id": lead_id,
        "project_id": project_id,
        "customer_name": cust_name,
        "customer_phone": cust_phone or None,
        "customer_email": cust_email or None,
        "category": category,
        "filename": fname,
        "mime_type": mime_type,
        "drive_file_id": drive_file_id,
        "drive_url": drive_url,
        "storage_bucket": storage_bucket,
        "storage_path": storage_path,
        "file_url": file_url,
        "source": source,
        "notes": notes or None,
    })
    return row


# ─── Separate Workflow 2: OCR Scan & Template Mapping ────────────────────

_VIN_VALID_CHARS = re.compile(r"[^A-HJ-NPR-Z0-9]", re.IGNORECASE)
_VIN_AMBIGUOUS = str.maketrans("IOQ", "100")  # chars that must never appear; map common OCR confusions


def _clean_vin(raw: Optional[str]) -> Optional[str]:
    """
    Post-process a VIN string extracted by OCR/LLM:
      - Strip spaces and dashes
      - Replace common OCR misreads: I→1, O→0, Q→0
      - Return None if the result is not exactly 17 characters
    """
    if not raw:
        return None
    cleaned = raw.strip().replace(" ", "").replace("-", "").upper()
    # Translate common ambiguous characters
    cleaned = cleaned.translate(_VIN_AMBIGUOUS)
    # Drop any remaining invalid chars (shouldn't happen, but be safe)
    cleaned = _VIN_VALID_CHARS.sub("", cleaned)
    if len(cleaned) == 17:
        return cleaned
    # If length is wrong, log it but still return raw so the user can verify
    logger.warning(f"VIN length after cleaning is {len(cleaned)} (not 17): '{cleaned}' (original: '{raw}')")
    return cleaned or None


async def scan_document(data: bytes, mime: str, doc_kind: str = "vehicle") -> Dict:
    """
    Extract structured fields from an image or PDF based on `doc_kind`:
      - 'vehicle' -> Fahrzeugschein / vehicle specs
      - 'id_card' -> Personalausweis / passport / client details
      - 'other'   -> combined client + vehicle extraction
    """
    from app.services.claude_service import (
        extract_any_document_from_image,
        extract_client_details,
        extract_client_details_from_image,
        extract_vehicle_specs,
        extract_vehicle_specs_from_image,
    )

    clean_mime = (mime or "").split(";")[0].strip().lower()
    if clean_mime.startswith("image/"):
        if doc_kind == "id_card":
            return await extract_client_details_from_image(data, clean_mime)
        if doc_kind == "other":
            return await extract_any_document_from_image(data, clean_mime)
        result = await extract_vehicle_specs_from_image(data, clean_mime)
        if "vin" in result:
            result["vin"] = _clean_vin(result["vin"])
            if result["vin"] is None:
                result.pop("vin", None)
        return result

    from app.services.pdf_service import extract_document_text
    suffix = _MIME_EXT.get(clean_mime, ".pdf")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        text = await asyncio.to_thread(extract_document_text, path)
        if text.strip():
            if doc_kind == "id_card":
                res = await extract_client_details(text)
            elif doc_kind == "other":
                v = await extract_vehicle_specs(text)
                c = await extract_client_details(text)
                res = {**c, **v}
            else:
                res = await extract_vehicle_specs(text)
            if res:
                if "vin" in res:
                    res["vin"] = _clean_vin(res["vin"])
                    if res["vin"] is None:
                        res.pop("vin", None)
                return res

        # Scanned PDF fallback: rasterize page 0 and run Claude Vision
        try:
            import fitz
            doc = fitz.open(path)
            if len(doc) > 0:
                pix = doc[0].get_pixmap(dpi=150)
                img_bytes = pix.tobytes("jpeg")
                if doc_kind == "id_card":
                    return await extract_client_details_from_image(img_bytes, "image/jpeg")
                if doc_kind == "other":
                    return await extract_any_document_from_image(img_bytes, "image/jpeg")
                result = await extract_vehicle_specs_from_image(img_bytes, "image/jpeg")
                if "vin" in result:
                    result["vin"] = _clean_vin(result["vin"])
                    if result["vin"] is None:
                        result.pop("vin", None)
                return result
        except Exception as e:
            logger.warning(f"PDF page rasterization failed: {e}")
        return {}
    finally:
        if os.path.exists(path):
            os.unlink(path)


def to_canonical_template_fields(extracted: Dict) -> Dict[str, str]:
    """Map OCR fields onto the canonical keys consumed by CAR-AGENTS PDF templates."""
    out: Dict[str, str] = {}
    full_name = " ".join(str(extracted[k]) for k in ("first_name", "last_name") if extracted.get(k)).strip()
    if full_name:
        out["full_name"] = full_name
    zip_city = " ".join(str(extracted[k]) for k in ("postcode", "city") if extracted.get(k)).strip()
    if zip_city:
        out["zip_city"] = zip_city

    mapping = {
        "address": "street",
        "id_number": "id_card",
        "manufacturer": "manufacturer",
        "model": "model",
        "vin": "vin",
        "licence_plate": "license",
        "initial_registration": "first_date",
        "mileage": "mileage",
        "power_ps": "power",
        "power_kw": "power",
        "displacement_ccm": "displacement",
        "tuv_expiry": "tuev_until",
    }
    for src, dst in mapping.items():
        if extracted.get(src) is not None and dst not in out:
            out[dst] = str(extracted[src])
    return out


def format_ocr_preview(extracted: Dict) -> str:
    if not extracted:
        return "No fields could be extracted."
    labels = {
        "manufacturer": "Marke",
        "model": "Modell",
        "vin": "VIN / FIN",
        "licence_plate": "Kennzeichen",
        "initial_registration": "Erstzulassung",
        "mileage": "Kilometerstand",
        "power_ps": "Leistung (PS)",
        "power_kw": "Leistung (kW)",
        "displacement_ccm": "Hubraum (ccm)",
        "tuv_expiry": "TÜV / HU",
        "first_name": "Vorname",
        "last_name": "Nachname",
        "id_number": "Ausweis-Nr",
        "date_of_birth": "Geburtsdatum",
        "nationality": "Nationalität",
        "address": "Straße",
        "postcode": "PLZ",
        "city": "Ort",
    }
    lines = ["🔎 *Extracted Fields:*"]
    for k, v in extracted.items():
        if v is not None and str(v).strip():
            val_str = str(v)
            # Flag VIN with length warning so user can verify
            suffix = ""
            if k == "vin":
                vin_len = len(val_str.replace(" ", ""))
                if vin_len != 17:
                    suffix = f" ⚠️ ({vin_len} chars — VIN must be 17, please verify)"
            lines.append(f"• {labels.get(k, k)}: `{val_str}`{suffix}")
    return "\n".join(lines)


def apply_ocr_to_crm(extracted: Dict, customer: Dict) -> Dict:
    """
    Save confirmed OCR fields into:
      1. Linked Lead record (vehicle + client ID fields)
      2. Linked Project record (vin, target_vehicle)
      3. Client Form Session `shared_core` (if a project session exists or is created)
    Returns summary dict of what was updated + matching contract template key.
    """
    lead_id = customer.get("lead_id")
    project_id = customer.get("project_id")
    updated_targets = []

    lead_map = {
        "manufacturer": "manufacturer",
        "model": "model",
        "vin": "vin",
        "licence_plate": "license_plate",
        "initial_registration": "initial_registration",
        "mileage": "mileage",
        "power_ps": "power_ps",
        "displacement_ccm": "displacement_ccm",
        "tuv_expiry": "tuev_until",
        "id_number": "id_number",
        "address": "address",
        "city": "city",
        "postcode": "postcode",
        "nationality": "nationality",
    }
    lead_updates = {col: str(extracted[k]) for k, col in lead_map.items() if extracted.get(k) is not None}
    full_name = " ".join(str(extracted[k]) for k in ("first_name", "last_name") if extracted.get(k)).strip()

    if lead_id and lead_updates:
        store.update_lead(lead_id, lead_updates)
        updated_targets.append("Lead")

    if project_id:
        proj_updates: Dict = {}
        if extracted.get("vin"):
            proj_updates["vin"] = str(extracted["vin"])
        veh = " ".join(str(extracted[k]) for k in ("manufacturer", "model") if extracted.get(k)).strip()
        if veh:
            proj_updates["target_vehicle"] = veh
        if proj_updates:
            store.update_project_fields(project_id, proj_updates)
            updated_targets.append("Deal")

    # Sync canonical template fields into `client_form_sessions.shared_core`
    canonical = to_canonical_template_fields(extracted)
    if customer.get("phone") and "phone" not in canonical:
        canonical["phone"] = customer["phone"]
    if customer.get("email") and "email" not in canonical:
        canonical["email"] = customer["email"]
    if full_name and "full_name" not in canonical:
        canonical["full_name"] = full_name

    session_synced = False
    if not store.MEMORY and project_id and canonical:
        try:
            from database import get_supabase
            sb = get_supabase()
            sess_res = sb.table("client_form_sessions").select("*").eq("project_id", project_id).limit(1).execute().data
            if sess_res:
                sess = sess_res[0]
                merged = {**(sess.get("shared_core") or {}), **canonical}
                sb.table("client_form_sessions").update({"shared_core": merged}).eq("id", sess["id"]).execute()
                session_synced = True
            else:
                pipeline = "buy" if (customer.get("deal_type") or "").upper() == "BUY" else "sell"
                sb.table("client_form_sessions").insert({
                    "project_id": project_id,
                    "pipeline": pipeline,
                    "form_link_token": uuid.uuid4().hex[:10],
                    "client_name": customer.get("name"),
                    "client_phone": customer.get("phone") or None,
                    "client_email": customer.get("email") or None,
                    "shared_core": canonical,
                    "status": "draft",
                }).execute()
                session_synced = True
            if session_synced:
                updated_targets.append("Template Data")
        except Exception as e:
            logger.warning(f"Failed syncing OCR into client_form_sessions: {e}")

    template_type = "buy_passiv" if (customer.get("deal_type") or "").upper() == "BUY" else "sell_b2c"
    return {
        "updated_targets": updated_targets,
        "canonical_fields": canonical,
        "recommended_template": template_type,
        "session_synced": session_synced,
    }


async def generate_and_store_contract_pdf(
    template_type: str,
    canonical_fields: Dict[str, str],
    customer: Dict,
) -> Dict:
    """
    §11 Automatic Document Pre-filling (1-click after WhatsApp OCR scan):
      - Renders the pre-filled PDF contract via pdf_service.render_contract_pdf()
      - Stores the generated PDF draft into the customer's Google Drive (`2. Legal Docs`)
        or Supabase Storage (`customer-documents`) and records it in `customer_documents`.
      - Returns {"file_name": ..., "file_url": ..., "template_label": ...}.
    """
    import tempfile
    from app.services.pdf_service import TEMPLATE_LABELS, render_contract_pdf

    data = dict(canonical_fields or {})
    if customer.get("name") and not data.get("full_name"):
        data["full_name"] = customer["name"]
    if customer.get("phone") and not data.get("phone"):
        data["phone"] = customer["phone"]
    if customer.get("email") and not data.get("email"):
        data["email"] = customer["email"]
    if template_type == "kaufvertrag" and not data.get("seller_name"):
        data["seller_name"] = data.get("full_name") or customer.get("name") or ""
    if template_type == "handover" and not data.get("giving_person"):
        data["giving_person"] = data.get("full_name") or customer.get("name") or ""
    data.setdefault("date", datetime.now(timezone.utc).strftime("%d.%m.%Y"))

    tmp_dir = tempfile.mkdtemp(prefix="car_agents_pdf_")
    out_path = await asyncio.to_thread(render_contract_pdf, template_type, data, tmp_dir)
    with open(out_path, "rb") as f:
        pdf_bytes = f.read()

    fname = os.path.basename(out_path)
    stored = await store_uploaded_document(
        file_bytes=pdf_bytes,
        filename=fname,
        mime_type="application/pdf",
        customer=customer,
        category="contract",
        source="WHATSAPP_OCR_CONTRACT",
        notes=f"Pre-filled contract draft ({TEMPLATE_LABELS.get(template_type, template_type)})",
    )
    return {
        "file_name": fname,
        "file_url": stored.get("file_url") or stored.get("drive_url"),
        "template_type": template_type,
        "template_label": TEMPLATE_LABELS.get(template_type, template_type),
        "document_row": stored,
    }
