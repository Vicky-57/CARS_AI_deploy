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
from typing import Dict, List, Optional

logger = logging.getLogger("whatsapp_store")

MEMORY = False

_mem_sessions: Dict[str, Dict] = {}
_mem_leads: Dict[str, Dict] = {}
_mem_comms: List[Dict] = []
_mem_projects: List[Dict] = []
_seen_ids: List[str] = []
_SEEN_MAX = 2000


def reset_memory() -> None:
    _mem_sessions.clear(); _mem_leads.clear(); _mem_comms.clear(); _mem_projects.clear(); _seen_ids.clear()


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


def search_leads_and_projects(term: str, limit: int = 5) -> Dict[str, List[Dict]]:
    term_l = term.lower()
    if MEMORY:
        leads = [l for l in _mem_leads.values() if term_l in (l.get("name") or "").lower()][:limit]
        projects = [p for p in _mem_projects if term_l in (p.get("client_name") or "").lower()][:limit]
        return {"leads": leads, "projects": projects}
    sb = _sb()
    leads = []
    projects = []
    try:
        leads = sb.table("leads").select("*").ilike("name", f"*{term}*").limit(limit).execute().data or []
    except Exception as e:
        logger.warning(f"Search leads failed: {e}")
    try:
        projects = sb.table("projects").select("*").ilike("client_name", f"*{term}*").limit(limit).execute().data or []
    except Exception as e:
        logger.warning(f"Search projects failed: {e}")
    return {"leads": leads, "projects": projects}


# ─── Projects (read only, for founder commands) ───────────────────────────

def list_active_projects(limit: int = 15) -> List[Dict]:
    if MEMORY:
        return [p for p in _mem_projects if p.get("status", "ACTIVE") == "ACTIVE"][:limit]
    return (
        _sb().table("projects").select("*").eq("status", "ACTIVE")
        .order("created_at", desc=True).limit(limit).execute().data or []
    )


# ─── Communications log ───────────────────────────────────────────────────

def save_communication(payload: Dict) -> None:
    if MEMORY:
        _mem_comms.append(dict(payload))
        return
    try:
        _sb().table("communications").insert(payload).execute()
    except Exception as e:
        logger.warning(f"communication log failed: {str(e)[:80]}")
