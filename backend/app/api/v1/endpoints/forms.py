"""
app/api/v1/endpoints/forms.py
────────────────────────────────────────────────────────────────────
Client Form Sessions & Documentation Generation API.

Flows implemented:
  1. POST   /forms/sessions                 → create a new client form session
  2. GET    /forms/sessions/{id}            → session detail + submissions
  3. PUT    /forms/sessions/{id}/stage      → save staged field data for one template
  4. POST   /forms/sessions/lookup          → resolve public link token → session
  5. GET    /forms/sessions/{id}/submissions→ per-template submissions
  6. POST   /forms/sessions/{id}/render/{template_type} → render filled PDF preview
  7. POST   /forms/sessions/{id}/approve/{template_type} → upload to Google Drive
  8. GET    /forms/download?path=...        → stream a rendered PDF for preview

The Documentation manager (Contracts.jsx) drives 5/6/7; the public staged
customer forms (SellForm/BuyForm) drive 1/2/3/4.
────────────────────────────────────────────────────────────────────
"""
import os
import uuid
import urllib.parse
import tempfile
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from database import get_supabase
from app.services.pdf_service import render_contract_pdf, TEMPLATE_FILES, TEMPLATE_LABELS, TEMPLATE_PIPELINE
from app.services.gdrive_service import upload_approved_contract_to_drive

router = APIRouter(prefix="/forms", tags=["Customer Form Sessions & Documentation"])


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    pipeline: str = Field("sell", description="'buy' or 'sell'")
    project_id: Optional[str] = Field(None, description="Supabase projects.id to link")
    client_name: Optional[str] = None


class StageSaveRequest(BaseModel):
    stage: int = Field(..., description="1..3 form section")
    template_type: str = Field(..., description="sell_b2c | buy_passiv | kaufvertrag | handover")
    field_data: Dict[str, Any] = Field(default_factory=dict, description="Canonical-key values")
    shared_core: Optional[Dict[str, Any]] = Field(None, description="Data entered once (name/contact/vehicle)")


class LinkLookupRequest(BaseModel):
    token: str


class RenderRequest(BaseModel):
    template_type: str = Field(..., description="Which template to render")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_session_or_404(session_id: str) -> dict:
    sb = get_supabase()
    res = sb.table("client_form_sessions").select("*").eq("id", session_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return res.data


def _ensure_valid_template(template_type: str):
    if template_type not in TEMPLATE_FILES:
        raise HTTPException(status_code=400, detail=f"Invalid template_type '{template_type}'")
    return template_type


def _render_temp(template_type: str, data: dict) -> str:
    """Render a temp PDF and return its file path."""
    out_dir = os.path.join(tempfile.gettempdir(), "car_agents_render")
    os.makedirs(out_dir, exist_ok=True)
    return render_contract_pdf(template_type, data or {}, out_dir)


def _merge_session_data(session: dict, template_type: str) -> dict:
    """Merge shared_core with all of this session's submission field_data.

    The client fills everything under the primary template (sell_b2c / buy_passiv).
    When rendering another template (kaufvertrag, handover) we still need those
    values, so we merge every template's submissions and let the requested
    template's own submissions (Maxim's edits) win last.

    Role aliasing: on a sell deal the client is the Verkäufer, on a buy deal the
    client is the Käufer. kaufvertrag FIELD_MAP keys are role-prefixed
    (seller_*/buyer_*), so we map the shared person/price fields accordingly.
    """
    merged = dict(session.get("shared_core") or {})
    sb = get_supabase()
    subs = sb.table("client_form_submissions") \
        .select("template_type", "field_data", "updated_at") \
        .eq("session_id", session["id"]) \
        .order("updated_at").execute()
    own = []
    for s in subs.data or []:
        if s.get("template_type") == template_type:
            own.append(s)
        else:
            for k, v in (s.get("field_data") or {}).items():
                if v not in (None, "", [], {}):
                    merged[k] = v
    for s in own:
        for k, v in (s.get("field_data") or {}).items():
            if v not in (None, "", [], {}):
                merged[k] = v

    if template_type in ("kaufvertrag", "handover"):
        pipeline = session.get("pipeline", "sell")
        client_name = merged.get("full_name") or merged.get("client_name") or ""
        if template_type == "kaufvertrag":
            # Prefill the intermediary (broker) from a constant — never the client.
            if not merged.get("intermediary"):
                merged["intermediary"] = (
                    "CAR-AGENTS, Inh. Maxim Lorenz, Lerchenweg 7, 93349 Mindelstetten"
                )
            role = "seller" if pipeline == "sell" else "buyer"
            suffix = {
                "full_name": "name", "street": "street", "zip_city": "zip_city",
                "phone": "phone", "email": "email",
            }
            for k, v in {
                "full_name": merged.get("full_name"),
                "street": merged.get("street"),
                "zip_city": merged.get("zip_city"),
                "phone": merged.get("phone"),
                "email": merged.get("email"),
            }.items():
                rf = f"{role}_{suffix[k]}"
                if v and rf not in merged:
                    merged[rf] = v
            if merged.get("final_price") and not merged.get("price"):
                merged["price"] = merged["final_price"]
        else:  # handover
            # The client is who we deal with directly. On sell the client gives the
            # car (giving), on buy the client receives it (receiving). Counter-party
            # names come from the kaufvertrag stage (seller_*/buyer_*).
            counterpart = merged.get("seller_name") or merged.get("buyer_name") or ""
            if pipeline == "sell":
                if not merged.get("giving_person") and client_name:
                    merged["giving_person"] = client_name
                if not merged.get("receiving_person"):
                    merged["receiving_person"] = counterpart or merged.get("buyer_name") or ""
            else:  # buy
                if not merged.get("receiving_person") and client_name:
                    merged["receiving_person"] = client_name
                if not merged.get("giving_person"):
                    merged["giving_person"] = counterpart or merged.get("seller_name") or ""
    return merged


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/sessions")
async def create_session(req: CreateSessionRequest):
    """Create a new client-facing form session and return its public link token."""
    pipeline = req.pipeline if req.pipeline in ("buy", "sell") else "sell"
    sb = get_supabase()

    row = {
        "pipeline": pipeline,
        "project_id": req.project_id,
        "client_name": req.client_name,
        "form_link_token": uuid.uuid4().hex[:12],
        "stage": 1,
        "status": "draft",
        "shared_core": {},
    }
    res = sb.table("client_form_sessions").insert(row).execute()
    session = res.data[0]
    session["form_url"] = f"/form/{pipeline}?token={session['form_link_token']}"
    return session


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Return a session's detail + its submissions."""
    session = _get_session_or_404(session_id)
    subs = get_supabase().table("client_form_submissions").select("*").eq("session_id", session_id).execute()
    session["submissions"] = subs.data or []
    session["form_url"] = f"/form/{session['pipeline']}?token={session['form_link_token']}"
    return session


@router.put("/sessions/{session_id}/stage")
async def save_stage(session_id: str, req: StageSaveRequest):
    """Persist one stage's field_data (and optionally shared_core) for a template."""
    sb = get_supabase()
    _get_session_or_404(session_id)
    _ensure_valid_template(req.template_type)

    payload = {
        "session_id": session_id,
        "stage": req.stage,
        "template_type": req.template_type,
        "field_data": req.field_data or {},
    }
    existing = sb.table("client_form_submissions") \
        .select("id").eq("session_id", session_id) \
        .eq("stage", req.stage).eq("template_type", req.template_type).execute()

    if existing.data:
        sb.table("client_form_submissions").update(payload).eq("id", existing.data[0]["id"]).execute()
    else:
        sb.table("client_form_submissions").insert(payload).execute()

    update = {"updated_at": _now()}
    if req.shared_core is not None:
        update["shared_core"] = req.shared_core
        if req.shared_core.get("full_name"):
            update["client_name"] = req.shared_core["full_name"]
        if req.shared_core.get("email"):
            update["client_email"] = req.shared_core["email"]
        if req.shared_core.get("phone"):
            update["client_phone"] = req.shared_core["phone"]
    sb.table("client_form_sessions").update(update).eq("id", session_id).execute()

    return {"success": True, "session_id": session_id, "stage": req.stage}


@router.post("/sessions/lookup")
async def lookup_by_token(req: LinkLookupRequest):
    """Look up a session by its public form_link_token (used at /form/sell?token=...)."""
    res = get_supabase().table("client_form_sessions").select("*").eq("form_link_token", req.token).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Form link not found or expired")
    session = res.data
    session["form_url"] = f"/form/{session['pipeline']}?token={session['form_link_token']}"
    return session


@router.get("/sessions/{session_id}/submissions")
async def list_submissions(session_id: str):
    """All per-template submissions for a session."""
    _get_session_or_404(session_id)
    subs = get_supabase().table("client_form_submissions").select("*").eq("session_id", session_id).execute()
    return subs.data or []


@router.post("/sessions/{session_id}/render/{template_type}")
async def render_templates(session_id: str, template_type: str):
    """Render a filled PDF preview for one template from session data."""
    session = _get_session_or_404(session_id)
    _ensure_valid_template(template_type)

    merged = _merge_session_data(session, template_type)
    try:
        file_path = _render_temp(template_type, merged)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Render failed: {str(e)}")

    # persist the render into the documents table (status draft)
    sb = get_supabase()
    client_name = session.get("client_name") or merged.get("full_name") or "General Clients"
    doc_payload = {
        "session_id": session_id,
        "project_id": session.get("project_id"),
        "pipeline": session["pipeline"],
        "template_type": template_type,
        "client_name": client_name,
        "status": "draft",
        "file_path": file_path,
        "updated_at": _now(),
    }
    existing = sb.table("documents").select("id").eq("session_id", session_id) \
        .eq("template_type", template_type).execute()
    if existing.data:
        sb.table("documents").update(doc_payload).eq("id", existing.data[0]["id"]).execute()
    else:
        sb.table("documents").insert(doc_payload).execute()

    return {
        "success": True,
        "template_type": template_type,
        "pipeline": session["pipeline"],
        "file_path": file_path,
        "preview_url": f"/api/v1/forms/download?path={urllib.parse.quote(file_path)}",
        "client_name": client_name,
    }


@router.post("/sessions/{session_id}/approve/{template_type}")
async def approve_and_upload(session_id: str, template_type: str):
    """Approve a rendered template and upload it to Google Drive under
    CAR-AGENTS Contracts/{buy|sell}/{ClientName}/{filename}."""
    session = _get_session_or_404(session_id)
    _ensure_valid_template(template_type)

    sb = get_supabase()
    doc = sb.table("documents").select("*").eq("session_id", session_id) \
        .eq("template_type", template_type).single().execute()
    if not doc.data or not doc.data.get("file_path") or not os.path.exists(doc.data["file_path"]):
        raise HTTPException(status_code=409, detail="No rendered PDF yet. Please Preview first.")

    file_path = doc.data["file_path"]
    client_name = session.get("client_name") or doc.data.get("client_name") or "General Clients"
    pipeline = session["pipeline"]
    filename = os.path.basename(file_path)

    res = await upload_approved_contract_to_drive(
        customer_name=client_name,
        contract_filename=filename,
        pdf_file_path=file_path,
        pipeline=pipeline,
    )
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Drive upload failed"))

    sb.table("documents").update({
        "status": "saved",
        "drive_url": res.get("drive_url"),
        "drive_file_id": res.get("drive_file_id"),
        "approved_at": _now(),
        "updated_at": _now(),
    }).eq("id", doc.data["id"]).execute()

    return {**res, "session_id": session_id, "template_type": template_type}


@router.get("/download")
async def download_pdf(path: str = Query(..., description="Absolute path of the rendered temp PDF")):
    """Stream a previously-rendered PDF so the portal browser can preview/download it."""
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    if not path.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files can be downloaded")
    return FileResponse(path, media_type="application/pdf", filename=os.path.basename(path))