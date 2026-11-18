"""
app/services/whatsapp_store.py
────────────────────────────────────────────────────────────────────────
Data access for the WhatsApp channel (Supabase), with an in-memory
fallback so the flow can be tested without a database.

  MEMORY = True  -> everything lives in Python dicts (tests / simulator)
  MEMORY = False -> Supabase. If the optional `whatsapp_sessions` table is
                    missing, sessions fall back to memory (lost on restart).
────────────────────────────────────────────────────────────────────────
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("whatsapp_store")

MEMORY = False

_mem_sessions: Dict[str, Dict] = {}
_mem_leads: Dict[str, Dict] = {}
_mem_comms: List[Dict] = []
_mem_projects: List[Dict] = []
_mem_meetings: List[Dict] = []
_mem_docs: List[Dict] = []
_seen_ids: List[str] = []
_SEEN_MAX = 2000


def reset_memory() -> None:
    _mem_sessions.clear(); _mem_leads.clear(); _mem_comms.clear(); _mem_projects.clear()
    _mem_meetings.clear(); _mem_docs.clear(); _seen_ids.clear()


def _sb():
    from database import get_supabase
    return get_supabase()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── De-duplication (Meta retries webhooks) ───────────────────────────────

def already_processed(message_id: Optional[str]) -> bool:
    """True if this WhatsApp message id was seen before; records it otherwise."""
    if not message_id:
        return False
    if message_id in _seen_ids:
        return True
    _seen_ids.append(message_id)
    if len(_seen_ids) > _SEEN_MAX:
        del _seen_ids[: _SEEN_MAX // 2]
    return False


# ─── Sessions (qualification state per phone) ─────────────────────────────

def get_session(phone: str) -> Optional[Dict]:
    if not MEMORY:
        try:
            res = _sb().table("whatsapp_sessions").select("state").eq("phone", phone).limit(1).execute()
            if res.data:
                return res.data[0]["state"]
            return _mem_sessions.get(phone)
        except Exception as e:
            logger.warning(f"whatsapp_sessions unavailable, using memory: {str(e)[:80]}")
    return _mem_sessions.get(phone)


def save_session(phone: str, state: Dict) -> None:
    _mem_sessions[phone] = state
    if MEMORY:
        return
    try:
        _sb().table("whatsapp_sessions").upsert({"phone": phone, "state": state, "updated_at": _now()}).execute()
    except Exception as e:
        logger.warning(f"whatsapp_sessions write failed (memory only): {str(e)[:80]}")


def delete_session(phone: str) -> None:
    _mem_sessions.pop(phone, None)
    if MEMORY:
        return
    try:
        _sb().table("whatsapp_sessions").delete().eq("phone", phone).execute()
    except Exception as e:
        logger.warning(f"whatsapp_sessions delete failed: {str(e)[:80]}")


# ─── Leads ────────────────────────────────────────────────────────────────

def find_lead_by_phone(phone: str) -> Optional[Dict]:
    if MEMORY:
        return next((l for l in _mem_leads.values() if l.get("phone") in (phone, "+" + phone)), None)
    res = _sb().table("leads").select("*").in_("phone", [phone, "+" + phone]).order("created_at", desc=True).limit(1).execute()
    return res.data[0] if res.data else None


def create_lead(payload: Dict) -> Dict:
    payload = dict(payload)
    if MEMORY:
        payload["id"] = str(uuid.uuid4())
        payload.setdefault("created_at", _now())
        _mem_leads[payload["id"]] = payload
        return payload
    res = _sb().table("leads").insert(payload).execute()
    return res.data[0] if res.data else {}


def update_lead(lead_id: str, updates: Dict, optional: Optional[Dict] = None) -> None:
    """
    Update base columns, then try optional columns (e.g. qualification_stage,
    is_qualified) separately so a missing column never breaks the main update.
    """
    updates = {**updates, "updated_at": _now()}
    if MEMORY:
        _mem_leads.setdefault(lead_id, {}).update(updates)
        if optional:
            _mem_leads[lead_id].update(optional)
        return
    _sb().table("leads").update(updates).eq("id", lead_id).execute()
    if optional:
        try:
            _sb().table("leads").update(optional).eq("id", lead_id).execute()
        except Exception as e:
            logger.info(f"optional lead columns not available: {str(e)[:80]}")


def list_leads(limit: int = 10) -> List[Dict]:
    if MEMORY:
        return sorted(_mem_leads.values(), key=lambda l: l.get("created_at", ""), reverse=True)[:limit]
    return _sb().table("leads").select("*").order("created_at", desc=True).limit(limit).execute().data or []


def search_customers(query: str, limit: int = 10) -> List[Dict]:
    from app.services import crm_service
    if MEMORY:
        return crm_service.search_customers(query, limit=limit, mem_leads=_mem_leads, mem_projects=_mem_projects)
    return crm_service.search_customers(query, limit=limit)


def recent_customers(limit: int = 8) -> List[Dict]:
    from app.services import crm_service
    if MEMORY:
        return crm_service.recent_customers(limit=limit, mem_leads=_mem_leads, mem_projects=_mem_projects)
    return crm_service.recent_customers(limit=limit)


# ─── Projects (Founder CRM Actions) ───────────────────────────────────────

def list_active_projects(limit: int = 15) -> List[Dict]:
    if MEMORY:
        return [p for p in _mem_projects if p.get("status", "ACTIVE") == "ACTIVE"][:limit]
    return (
        _sb().table("projects").select("*").eq("status", "ACTIVE")
        .order("created_at", desc=True).limit(limit).execute().data or []
    )


def update_project_fields(project_id: str, updates: Dict) -> None:
    """Update vehicle/client metadata on an existing project."""
    if not project_id or not updates:
        return
    clean = {k: v for k, v in updates.items() if v is not None}
    if not clean:
        return
    clean["updated_at"] = _now()
    if MEMORY:
        for p in _mem_projects:
            if p.get("id") == project_id:
                p.update(clean)
        return
    try:
        _sb().table("projects").update(clean).eq("id", project_id).execute()
    except Exception as e:
        logger.warning(f"update_project_fields failed: {e}")


def convert_lead_to_project(lead_query: str) -> Optional[Dict]:
    from app.services import crm_service
    if MEMORY:
        return crm_service.convert_lead_to_project(lead_query, mem_leads=_mem_leads, mem_projects=_mem_projects)
    return crm_service.convert_lead_to_project(lead_query)


def update_project_stage(client_query: str, target_stage_str: str) -> Optional[Tuple[Dict, str]]:
    from app.services import crm_service
    if MEMORY:
        return crm_service.update_project_stage(client_query, target_stage_str, mem_projects=_mem_projects)
    return crm_service.update_project_stage(client_query, target_stage_str)


# ─── Customer Uploaded Documents ──────────────────────────────────────────

def save_customer_document(payload: Dict) -> Dict:
    doc = {**payload, "created_at": _now()}
    if MEMORY:
        doc.setdefault("id", str(uuid.uuid4()))
        _mem_docs.append(doc)
        return doc
    res = _sb().table("customer_documents").insert(payload).execute()
    return res.data[0] if res.data else doc


def list_customer_documents(lead_id: Optional[str] = None, project_id: Optional[str] = None, limit: int = 20) -> List[Dict]:
    if MEMORY:
        out = _mem_docs
        if lead_id:
            out = [d for d in out if d.get("lead_id") == lead_id]
        if project_id:
            out = [d for d in out if d.get("project_id") == project_id]
        return out[:limit]
    q = _sb().table("customer_documents").select("*").order("created_at", desc=True).limit(limit)
    if lead_id:
        q = q.eq("lead_id", lead_id)
    if project_id:
        q = q.eq("project_id", project_id)
    return q.execute().data or []


# ─── Communications log ───────────────────────────────────────────────────

def save_communication(payload: Dict) -> None:
    if MEMORY:
        _mem_comms.append(dict(payload))
        return
    try:
        _sb().table("communications").insert(payload).execute()
    except Exception as e:
        logger.warning(f"communication log failed: {str(e)[:80]}")
