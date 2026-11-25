"""
app/services/email_triage_store.py
────────────────────────────────────────────────────────────────────────
Persistence for Phase 1 email inquiries/triage decisions, founder sender rules,
and B2B cooperation/service deals.
Tables: email_triage, sender_rules, b2b_deals (docs/db/supabase_v3_5_phase1.sql).
────────────────────────────────────────────────────────────────────────
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

logger = logging.getLogger("email_triage_store")

_mem_triage: List[Dict] = []
_mem_rules: Dict[str, str] = {}
_mem_b2b: List[Dict] = []
_warned = False


def _use_memory() -> bool:
    from app.services import whatsapp_store as ws
    return bool(ws.MEMORY)


def reset_memory() -> None:
    _mem_triage.clear()
    _mem_rules.clear()
    _mem_b2b.clear()


def _sb():
    from database import get_supabase
    return get_supabase()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _warn_once(e: Exception) -> None:
    global _warned
    if not _warned:
        logger.warning(f"email_triage tables warning: {e}")
        _warned = True


# ─── Decisions & Inquiries ────────────────────────────────────────────────

def seen_message(message_id: Optional[str]) -> bool:
    if not message_id:
        return False
    if any(r.get("message_id") == message_id for r in _mem_triage):
        return True
    if _use_memory():
        return False
    try:
        return bool(_sb().table("email_triage").select("id").eq("message_id", message_id).limit(1).execute().data)
    except Exception as e:
        _warn_once(e)
        return False


def log_decision(rec: Dict) -> Dict:
    """Insert or upsert an inquiry decision row; always returns stored row with id."""
    row = {**rec, "id": rec.get("id") or str(uuid.uuid4()), "created_at": rec.get("created_at") or _now()}
    if _use_memory():
        _mem_triage.append(row)
        return row
    payload = {k: v for k, v in rec.items() if v is not None}
    try:
        res = _sb().table("email_triage").insert(payload).execute()
        stored = res.data[0] if res.data else row
        _mem_triage.append({"message_id": stored.get("message_id"), "id": stored.get("id")})
        return stored
    except Exception as e:
        _warn_once(e)
        _mem_triage.append(row)
        return row


def get_inquiry(row_id: str) -> Optional[Dict]:
    if _use_memory():
        return next((r for r in _mem_triage if r.get("id") == row_id or str(r.get("id", "")).startswith(row_id)), None)
    try:
        rows = _sb().table("email_triage").select("*").eq("id", row_id).limit(1).execute().data or []
        return rows[0] if rows else None
    except Exception:
        return None


def find_inquiry(short_or_full_id: str) -> Optional[Dict]:
    sid = (short_or_full_id or "").strip().lower()
    if not sid:
        return None
    if _use_memory():
        for r in reversed(_mem_triage):
            if str(r.get("id", "")).lower().startswith(sid):
                return r
        return None
    try:
        rows = _sb().table("email_triage").select("*").order("created_at", desc=True).limit(100).execute().data or []
        for r in rows:
            if str(r.get("id", "")).lower().startswith(sid):
                return r
    except Exception as e:
        _warn_once(e)
    return None


def update_decision(row_id: str, fields: Dict) -> Optional[Dict]:
    for r in _mem_triage:
        if r.get("id") == row_id:
            r.update(fields)
    if _use_memory():
        return next((r for r in _mem_triage if r.get("id") == row_id), None)
    try:
        res = _sb().table("email_triage").update(fields).eq("id", row_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        _warn_once(e)
        return None


def list_inquiries(limit: int = 100, days: Optional[int] = None) -> List[Dict]:
    if _use_memory():
        return list(reversed(_mem_triage))[:limit]
    try:
        q = _sb().table("email_triage").select("*").order("created_at", desc=True).limit(limit)
        if days:
            since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            q = q.gte("created_at", since)
        return q.execute().data or []
    except Exception as e:
        _warn_once(e)
        return []


def list_pending(limit: int = 15) -> List[Dict]:
    if _use_memory():
        rows = [
            r for r in _mem_triage
            if (r.get("decision") in ("review", "lead") or r.get("draft_status") == "pending")
            and not r.get("resolution")
        ]
        return rows[-limit:]
    try:
        rows = (
            _sb().table("email_triage")
            .select("*")
            .is_("resolution", "null")
            .in_("decision", ["review", "lead", "b2b", "invoice"])
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
            .data or []
        )
        return rows
    except Exception as e:
        _warn_once(e)
        return [r for r in _mem_triage if r.get("decision") == "review" and not r.get("resolution")][-limit:]


def find_pending(short_id_str: str) -> Optional[Dict]:
    sid = (short_id_str or "").strip().lower()
    if not sid:
        return None
    for r in list_pending(80):
        if str(r.get("id", "")).lower().startswith(sid):
            return r
    return find_inquiry(sid)


def short_id(row: Dict) -> str:
    return str(row.get("id", ""))[:6]


# ─── Sender rules ─────────────────────────────────────────────────────────

def get_rule(sender_email: str) -> Optional[str]:
    addr = (sender_email or "").lower().strip()
    dom = addr.split("@")[-1] if "@" in addr else ""
    if _use_memory():
        return _mem_rules.get(addr) or _mem_rules.get(dom)
    if addr in _mem_rules:
        return _mem_rules[addr]
    try:
        rows = _sb().table("sender_rules").select("pattern,rule").in_("pattern", [addr, dom]).execute().data or []
        by_pat = {r["pattern"]: r["rule"] for r in rows}
        return by_pat.get(addr) or by_pat.get(dom)
    except Exception as e:
        _warn_once(e)
        return None


def set_rule(pattern: str, rule: str) -> None:
    pattern = (pattern or "").lower().strip()
    if not pattern or rule not in ("allow", "deny"):
        return
    _mem_rules[pattern] = rule
    if _use_memory():
        return
    try:
        _sb().table("sender_rules").upsert({"pattern": pattern, "rule": rule}, on_conflict="pattern").execute()
    except Exception as e:
        _warn_once(e)


# ─── B2B Deals (§7 Dedicated B2B CRM Page) ────────────────────────────────

def list_b2b_deals(limit: int = 100) -> List[Dict]:
    if _use_memory():
        return list(reversed(_mem_b2b))[:limit]
    try:
        return _sb().table("b2b_deals").select("*").order("created_at", desc=True).limit(limit).execute().data or []
    except Exception as e:
        _warn_once(e)
        return []


def create_b2b_deal(payload: Dict) -> Dict:
    row = {**payload, "id": payload.get("id") or str(uuid.uuid4()), "created_at": _now(), "updated_at": _now()}
    if _use_memory():
        _mem_b2b.append(row)
        return row
    clean = {k: v for k, v in payload.items() if v is not None}
    try:
        res = _sb().table("b2b_deals").insert(clean).execute()
        return res.data[0] if res.data else row
    except Exception as e:
        _warn_once(e)
        _mem_b2b.append(row)
        return row


def update_b2b_deal(deal_id: str, fields: Dict) -> Optional[Dict]:
    fields = {**fields, "updated_at": _now()}
    if _use_memory():
        for d in _mem_b2b:
            if d.get("id") == deal_id:
                d.update(fields)
                return d
        return None
    try:
        res = _sb().table("b2b_deals").update(fields).eq("id", deal_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        _warn_once(e)
        return None


def delete_b2b_deal(deal_id: str) -> bool:
    if _use_memory():
        _mem_b2b[:] = [d for d in _mem_b2b if d.get("id") != deal_id]
        return True
    try:
        _sb().table("b2b_deals").delete().eq("id", deal_id).execute()
        return True
    except Exception as e:
        _warn_once(e)
        return False


# ─── Stats ────────────────────────────────────────────────────────────────

def stats(days: int = 30) -> Dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    if _use_memory():
        rows = list(_mem_triage)
    else:
        try:
            rows = (
                _sb().table("email_triage")
                .select("decision,category,layer,is_qualified,draft_status,created_at")
                .gte("created_at", since.isoformat())
                .limit(5000)
                .execute()
                .data or []
            )
        except Exception as e:
            _warn_once(e)
            rows = []
    out = {
        "total": len(rows),
        "qualified": sum(1 for r in rows if r.get("is_qualified")),
        "pending_drafts": sum(1 for r in rows if r.get("draft_status") == "pending"),
        "decisions": {},
        "categories": {},
        "layers": {},
        "days": days,
    }
    for r in rows:
        for key, field in (("decisions", "decision"), ("categories", "category"), ("layers", "layer")):
            v = str(r.get(field))
            out[key][v] = out[key].get(v, 0) + 1
    return out
