"""
app/services/pdf_service.py
────────────────────────────────────────────────────────────────────────
1. Text Extraction from PDFs and Images (pdfplumber + pytesseract).
2. Document / Contract Pre-filling & PDF Generation for the 4 CAR-AGENTS
   templates using a PyMuPDF (fitz) box-fit fill engine:

      sell_b2c   → Vermittlungsvertrag B2C (Aktiv)         [token template]
      buy_passiv → Vermittlungsvertrag Beschaffung (Passiv)
      kaufvertrag→ Kaufvertrag C2C (Bilingual)
      handover   → Fahrzeug-Übergabeprotokoll

   Fill strategy (approved "Option A"):
     - sell_b2c  : tokens like [Kunde_Name_Vorname] are auto-detected at
                   runtime and the value is re-drawn box-fitted.
     - buy_passiv, kaufvertrag, handover: The templates ship with blank
                   underscore lines / check-boxes (no [tokens]), so we use an
                   explicit FIELD_MAP (coordinates) that the Documentation
                   editor can tweak. Any field without a box is skipped.
────────────────────────────────────────────────────────────────────────
"""
import os
import shutil
import tempfile
import pdfplumber
from PIL import Image
from typing import List

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:  # pragma: no cover
    fitz = None
    PYMUPDF_AVAILABLE = False

try:
    import pytesseract
    if os.name == "nt":
        tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.path.exists(tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
    OCR_AVAILABLE = True
except ImportError:
    pytesseract = None
    OCR_AVAILABLE = False


# ─── Template registry ────────────────────────────────────────────────────────

TEMPLATE_FILES = {
    "sell_b2c": "CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf",
    "buy_passiv": "CAR-AGENTS_Vermittlungsvertrag_Beschaffung_Final__passiv.pdf",
    "kaufvertrag": "Kaufvertrag-C2C-Bilingual.pdf",
    "handover": "CAR-AGENTS_Fahrzeug-Übergabeprotokoll.pdf",
}

TEMPLATE_LABELS = {
    "sell_b2c": "Vermittlungsvertrag B2C (Aktiv)",
    "buy_passiv": "Vermittlungsvertrag Beschaffung (Passiv)",
    "kaufvertrag": "Kaufvertrag C2C (Bilingual)",
    "handover": "Fahrzeug-Übergabeprotokoll",
}

TEMPLATE_PIPELINE = {
    "sell_b2c": "sell",
    "buy_passiv": "buy",
    "kaufvertrag": "sell",
    "handover": "sell",
}

SAFE_FONT = "helv"


def _client_data_dir() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "client_data"))


# ─── sell_b2c token → canonical field key ────────────────────────────────────
# Engines fill values by canonical key. The UI / forms / API all agree on these
# canonical keys. sell_b2c placeholders are mapped here; the manual templates
# define the same keys against coordinates in FIELD_MAP below.
SELL_B2C_TOKEN_KEY = {
    "Kunde_Name_Vorname": "full_name",
    "Kunde_Telefon": "phone",
    "Kunde_Strasse": "street",
    "Kunde_Email": "email",
    "Kunde_PLZ_Ort": "zip_city",
    "Kunde_Ausweis_Nr": "id_card",
    "Fahrzeug_Hersteller": "manufacturer",
    "Fahrzeug_Typ": "model",
    "Fahrzeug_VIN": "vin",
    "Fahrzeug_Kennzeichen": "license",
    "Fahrzeug_Erstzulassung": "first_date",
    "Fahrzeug_KM_Stand": "mileage",
    "Fahrzeug_Leistung": "power",
    "Fahrzeug_Hubraum": "displacement",
    "Fahrzeug_TUEV": "tuev_until",
    "Fahrzeug_Halter_Anzahl": "owners",
    "Fahrzeug_Farbe": "color",
    "Fahrzeug_ZB2_Nr": "zb2",
    "Fahrzeug_Gaspruefung": "gas_until",
    "Anzahl_Schluessel": "keys",
    "Anzahl_Schlüssel": "keys",
    "Anzahl_Schl\ufffdssel": "keys",
    "Sonstiges": "misc",
    "Tausch_KM": "engine_mileage",
    "Tausch_Datum": "engine_date",
    "Fahrzeug_Rechte_DritterDetails": "reimport",
    "Fahrzeug_Maengel_Vorschaeden": "accident_details",
    "Fahrzeug_Sonderausstattung": "special_equipment",
    "Fahrzeug_Preis_Untergrenze": "min_price",
    "Fahrzeug_Schluessel_Anzahl": "keys",
    "Sondervereinbarung_Freitext_Block": "special_agreements",
    "Vollmacht_Freitext": "reimport",
    "XP_Freitext_Instandsetzung": "repair_service",
    "XP_Freitext_Instandhaltung": "maintenance_service",
    "XP_Freitext_Pflege": "care_service",
}

# XA_Kosten_* (Anlage A internal service prices) and XP_Kosten_1..3 (external)
# are token placeholders whose box is auto-detected too (GET page 5).
PRICE_TOKEN_KEYS = {
    "XA_Kosten_04": "price_1", "XA_Kosten_05": "price_2", "XA_Kosten_06": "price_3",
    "XA_Kosten_07": "price_4", "XA_Kosten_08": "price_5", "XA_Kosten_So": "price_6",
    "XA_Kosten_12": "price_7", "XA_Kosten_S2": "price_8", "XA_Kosten_14": "price_9",
    "XA_Kosten_16": "price_10", "XA_Kosten_17": "price_11",
    "XP_Kosten_1": "repair_price", "XP_Kosten_2": "maintenance_price", "XP_Kosten_3": "care_price",
}


# ── Manual field maps for token-less templates ───────────────────────────────
# box = [page, x0, y0, x1, y1]  (page is 1-based). fontsize per field.
FIELD_MAP = {
    "buy_passiv": [
        # page 1 (index 0 in layout)
        {"key": "full_name", "box": [1, 130, 270, 400, 288], "size": 9.0},
        {"key": "phone", "box": [1, 350, 268, 570, 286]},
        {"key": "street", "box": [1, 130, 294, 400, 310]},
        {"key": "email", "box": [1, 350, 292, 570, 310]},
        {"key": "zip_city", "box": [1, 100, 319, 400, 335]},
        {"key": "id_card", "box": [1, 390, 319, 570, 335]},
        {"key": "salutation", "box": [1, 54, 270, 130, 286]},
        # search profile p1
        {"key": "manufacturer", "box": [1, 120, 672, 290, 688]},
        {"key": "model", "box": [1, 365, 672, 570, 688]},
        {"key": "fuel", "box": [1, 120, 692, 290, 708]},
        {"key": "gearbox", "box": [1, 360, 692, 570, 708]},
        {"key": "first_date", "box": [1, 130, 716, 290, 732]},
        {"key": "max_km", "box": [1, 400, 716, 570, 732]},
        {"key": "power", "box": [1, 170, 737, 290, 753]},
        {"key": "displacement", "box": [1, 390, 737, 570, 753]},
        {"key": "tuev_until", "box": [1, 110, 762, 290, 778]},
        {"key": "owners", "box": [1, 420, 762, 570, 778]},
        {"key": "wanted_colors", "box": [1, 175, 783, 290, 800]},
        {"key": "other_req", "box": [1, 365, 783, 570, 800]},
        # page 2 requirements
        {"key": "must_haves", "box": [2, 50, 130, 540, 168]},
        {"key": "nice_haves", "box": [2, 50, 260, 540, 300]},
        {"key": "no_gos", "box": [2, 50, 400, 540, 412]},
        {"key": "max_damage", "box": [2, 125, 447, 540, 460]},
        # page 3 sondervereinbarungen free text
        {"key": "special_agreements", "box": [3, 55, 300, 540, 430]},
        # page 5 services — repair/maintenance/care (Anlage A Teil 2)
        {"key": "repair_service", "box": [5, 90, 550, 340, 566]},
        {"key": "repair_price", "box": [5, 404, 556, 424, 572]},
        {"key": "maintenance_service", "box": [5, 90, 583, 340, 599]},
        {"key": "maintenance_price", "box": [5, 404, 590, 424, 606]},
        {"key": "care_service", "box": [5, 90, 617, 340, 633]},
        {"key": "care_price", "box": [5, 404, 623, 424, 639]},
        # optional internal service prices (Anlage A Teil 1) top 11 slots
        {"key": "price_1", "box": [5, 306, 199, 384, 214]},
        {"key": "price_2", "box": [5, 306, 221, 384, 236]},
        {"key": "price_3", "box": [5, 306, 243, 384, 258]},
        {"key": "price_4", "box": [5, 306, 264, 384, 279]},
        {"key": "price_5", "box": [5, 306, 287, 384, 302]},
        {"key": "price_6", "box": [5, 306, 309, 384, 324]},
        {"key": "price_7", "box": [5, 306, 330, 384, 345]},
        {"key": "price_8", "box": [5, 306, 352, 384, 367]},
        {"key": "price_9", "box": [5, 306, 374, 384, 389]},
        {"key": "price_10", "box": [5, 306, 396, 384, 411]},
        {"key": "price_11", "box": [5, 306, 418, 384, 433]},
        # Ort Datum p5 / p7 handled by handover/dates
        {"key": "place", "box": [5, 70, 674, 300, 690]},
        {"key": "date", "box": [5, 120, 674, 300, 690]},
    ],
    "kaufvertrag": [
        # p1 intermediary / Vermittler (label y=134, single wide box y=146-176).
        # The intermediary is the broker (CAR-AGENTS), NOT the client. It is
        # prefilled from the CAR_AGENTS_BROKER constant in the merge, so it must
        # have a distinct key and must not be fed by the unprefixed person keys
        # (full_name/etc.) which would collide with the Verkäufer block below.
        {"key": "intermediary", "box": [1, 55, 150, 540, 172]},
        # p1 seller (label "Verkäufer" y=209) — fields at y=246 (Name) / 287 / 328
        {"key": "seller_name", "box": [1, 42, 255, 250, 273]},
        {"key": "seller_street", "box": [1, 42, 295, 250, 313]},
        {"key": "seller_zip_city", "box": [1, 298, 295, 560, 313]},
        {"key": "seller_phone", "box": [1, 42, 335, 250, 353]},
        {"key": "seller_email", "box": [1, 298, 335, 560, 353]},
        # p1 buyer (label "Käufer" y=380) — fields at y=417 / 458 / 499
        {"key": "buyer_name", "box": [1, 42, 426, 300, 444]},
        {"key": "buyer_street", "box": [1, 42, 466, 300, 484]},
        {"key": "buyer_zip_city", "box": [1, 298, 466, 560, 484]},
        {"key": "buyer_phone", "box": [1, 42, 506, 300, 524]},
        {"key": "buyer_email", "box": [1, 298, 506, 560, 524]},
        {"key": "price", "box": [1, 180, 730, 280, 748], "align": "center"},
        # p2 vehicle details
        {"key": "manufacturer", "box": [2, 48, 110, 280, 128]},
        {"key": "model", "box": [2, 302, 110, 560, 128]},
        {"key": "color", "box": [2, 48, 146, 280, 164]},
        {"key": "vin", "box": [2, 302, 146, 560, 164]},
        {"key": "license", "box": [2, 48, 182, 280, 200]},
        {"key": "first_date", "box": [2, 302, 182, 560, 200]},
        {"key": "displacement", "box": [2, 48, 218, 280, 236]},
        {"key": "power", "box": [2, 302, 218, 560, 236]},
        {"key": "mileage", "box": [2, 48, 254, 280, 272]},
        {"key": "owners", "box": [2, 302, 254, 560, 272]},
        {"key": "zb2", "box": [2, 48, 289, 280, 307]},
        {"key": "tuev_until", "box": [2, 302, 305, 560, 323]},
        {"key": "gas_until", "box": [2, 302, 331, 560, 349]},
        # p3 tread depths
        {"key": "tread_vl", "box": [3, 281, 294, 360, 310]},
        {"key": "tread_vr", "box": [3, 384, 294, 438, 310]},
        {"key": "tread_hl", "box": [3, 281, 320, 360, 336]},
        {"key": "tread_hr", "box": [3, 384, 320, 440, 336]},
        {"key": "engine_number", "box": [3, 337, 403, 500, 419]},
        {"key": "engine_mileage", "box": [3, 252, 438, 540, 456]},
        # p4 keys + other
        {"key": "keys", "box": [4, 330, 374, 380, 392]},
        {"key": "buyer_other", "box": [4, 140, 407, 500, 420]},
        {"key": "place", "box": [4, 60, 640, 250, 660]},
        {"key": "date", "box": [4, 120, 640, 250, 660]},
    ],
    "handover": [
        # p1 people
        {"key": "giving_person", "box": [1, 28, 266, 566, 284]},
        {"key": "receiving_person", "box": [1, 28, 319, 566, 336]},
        # p1 vehicle data
        {"key": "manufacturer", "box": [1, 83, 383, 272, 400]},
        {"key": "model", "box": [1, 319, 383, 566, 400]},
        {"key": "license", "box": [1, 130, 402, 270, 418]},
        {"key": "vin", "box": [1, 360, 402, 566, 418]},
        {"key": "mileage", "box": [1, 180, 421, 100 + 175, 437]},
        {"key": "tuev_until", "box": [1, 374, 421, 566, 437]},
        # p1 keys handed over
        {"key": "keys", "box": [1, 130, 597, 200, 614]},
        # p2 verbal notes
        {"key": "notes", "box": [2, 40, 560, 540, 580]},
        # signature line details
        {"key": "place", "box": [2, 90, 793, 200, 810]},
        {"key": "date", "box": [2, 120, 793, 200, 810]},
    ],
}


# ─── Drawing helpers ──────────────────────────────────────────────────────────

def _wrap_words(text: str, box_w: float, fs: float) -> List[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = (cur + " " + word).strip()
        if fitz.get_text_length(trial, fontname=SAFE_FONT, fontsize=fs) <= box_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def _draw_fitted(page, x0: float, y0: float, x1: float, y1: float, value: str,
                 fontsize: float = 9.0, align: str = "left") -> None:
    """Draw `value` into the box, wrapping words and auto-shrinking the font so
    it never exceeds the box's right edge (x1). If it cannot fit on one line we
    let it wrap; the box height is a soft limit (we keep the given baseline)."""
    if not value or not str(value).strip():
        return
    text = " ".join(str(value).split())
    box_w = (x1 - x0) or 40.0

    fs = fontsize
    # shrink until the widest line fits one box width going down to 6pt
    while fs > 6.0:
        if all(fitz.get_text_length(l, SAFE_FONT, fs) <= box_w for l in _wrap_words(text, box_w, fs)):
            break
        fs -= 0.5
    lines = _wrap_words(text, box_w, fs)

    if align == "center":
        for i, line in enumerate(lines):
            w = fitz.get_text_length(line, SAFE_FONT, fs)
            xx = x0 + max(0, (box_w - w) / 2)
            page.insert_text((xx, y0 + (i + 1) * fs), line, fontname=SAFE_FONT, fontsize=fs, color=(0, 0, 0))
    else:
        for i, line in enumerate(lines):
            y = y0 + (i + 1) * fs
            if y > y1 + 6:
                break
            page.insert_text((x0, y), line, fontname=SAFE_FONT, fontsize=fs, color=(0, 0, 0))


_LEGACY_TOKEN_KEYS = ({**SELL_B2C_TOKEN_KEY, **PRICE_TOKEN_KEYS})


def _fill_token_document(doc, data: dict) -> None:
    """Auto-detect '[TokenX]' spans and box-fill them with values."""
    for pno in range(len(doc)):
        page = doc[pno]
        for block in page.get_text("dict")["blocks"]:
            if "lines" not in block:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    st = span["text"].strip()
                    if not st.startswith("["):
                        continue
                    token = st.replace("[", "").replace("]", "").strip()
                    key = SELL_B2C_TOKEN_KEY.get(token) or PRICE_TOKEN_KEYS.get(token)
                    if not key:
                        continue
                    val = data.get(key)
                    if val is None or str(val).strip() == "":
                        continue
                    x0, y0, x1, y1 = span["bbox"]
                    size = span.get("size", 9.0)
                    box_w = max(x1 - x0, 120.0)
                    page.add_redact_annot(fitz.Rect(x0, y0, x0 + box_w, y1), fill=(1, 1, 1))
                    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
                    _draw_fitted(page, x0, y0 + size * 0.15, x0 + box_w, y1, str(val), fontsize=size - 1.0)


def _fill_manual_document(doc, template_type: str, data: dict) -> None:
    """Fill a template purely from FIELD_MAP coordinates."""
    for spec in FIELD_MAP.get(template_type, []):
        key = spec["key"]
        align = spec.get("align", "left")
        val = data.get(key)
        if val is None or str(val).strip() == "":
            continue
        pno, x0, y0, x1, y1 = spec["box"]
        page = doc[pno - 1]
        _draw_fitted(page, x0, y0, x1, y1, str(val),
                     fontsize=spec.get("size", spec.get("fontsize", 9.0)), align=align)


def render_contract_pdf(template_type: str, data: dict, output_dir: str) -> str:
    """Fill the given template with `data` (canonical keys) and return the
    absolute path of the produced PDF file. Raises ValueError on bad template."""
    if template_type not in TEMPLATE_FILES:
        raise ValueError(f"Invalid template type. Must be one of: {list(TEMPLATE_FILES.keys())}")
    if not PYMUPDF_AVAILABLE:
        raise RuntimeError("PyMuPDF (pymupdf) is not installed. Run: pip install pymupdf")

    client_data_dir = _client_data_dir()
    src = os.path.join(client_data_dir, TEMPLATE_FILES[template_type])
    if not os.path.exists(src):
        raise FileNotFoundError(f"Template not found: {src}")

    os.makedirs(output_dir, exist_ok=True)
    doc = fitz.open(src)

    if template_type == "sell_b2c":
        _fill_token_document(doc, data)
    else:
        _fill_manual_document(doc, template_type, data)

    out_name = f"Generated_{template_type}_{int(__import__('time').time())}.pdf"
    out_path = os.path.join(output_dir, out_name)
    doc.save(out_path, garbage=4, deflate=True)
    doc.close()
    return out_path


# ── Legacy wrapper (kept for the /contracts/generate endpoint) ───────────────

def fill_contract_template(template_type: str, custom_data: dict, output_dir: str) -> dict:
    """Backward-compatible wrapper around render_contract_pdf."""
    filename = TEMPLATE_FILES.get(template_type)
    if not filename:
        raise ValueError(f"Invalid template type. Must be one of: {list(TEMPLATE_FILES.keys())}")
    if not custom_data:
        custom_data = {}
    # adapt legacy custom_data (may carry already-token keys) by mapping tokens→keys
    mapped = {}
    for k, v in custom_data.items():
        if k.startswith("[") and k.endswith("]"):
            mk = SELL_B2C_TOKEN_KEY.get(k.strip("[]"))
            if mk:
                mapped[mk] = v
            else:
                mapped[k] = v
        else:
            mapped[k] = v
    out_path = render_contract_pdf(template_type, mapped, output_dir)
    return {
        "success": True,
        "template_label": TEMPLATE_LABELS[template_type],
        "file_name": os.path.basename(out_path),
        "file_path": out_path,
    }


# ─── Text extraction (unchanged helpers) ─────────────────────────────────────

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using pdfplumber (digital) or pytesseract (scanned fallback)."""
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception:
        pass

    if not text.strip() and OCR_AVAILABLE:
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    img = page.to_image(resolution=300).original
                    text += pytesseract.image_to_string(img, lang="deu+eng") + "\n"
        except Exception:
            pass

    return text.strip()


def extract_text_from_image(file_path: str) -> str:
    """Extract text from an image scan using pytesseract OCR."""
    if not OCR_AVAILABLE:
        return ""
    img = Image.open(file_path)
    return pytesseract.image_to_string(img, lang="deu+eng").strip()


def extract_document_text(file_path: str) -> str:
    """Smart router: choose PDF or image extraction based on file extension."""
    lower = file_path.lower()
    if lower.endswith(".pdf"):
        return extract_text_from_pdf(file_path)
    elif lower.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp")):
        return extract_text_from_image(file_path)
    return ""