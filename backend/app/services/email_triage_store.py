"""
app/services/email_triage_store.py
────────────────────────────────────────────────────────────────────────
Persistence for email triage decisions and founder sender rules.
Tables: email_triage, sender_rules (docs/db/supabase_v3_4_email_triage.sql).

If the tables are missing the module degrades safely: decisions are kept in
process memory (so the same mail is not handled twice while the process lives)
and a warning is logged.
────────────────────────────────────────────────────────────────────────
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

logger = logging.getLogger("email_triage_store")

_mem_triage: List[Dict] = []
_mem_rules: Dict[str, str] = {}
_warned = False


def _use_memory() -> bool:
    from app.services import whatsapp_store as ws
    return bool(ws.MEMORY)


def reset_memory() -> None:
    _mem_triage.clear()
    _mem_rules.clear()


def _sb():
    from database import get_supabase
    return get_supabase()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _warn_once(e: Exception) -> None:
    global _warned
    if not _warned:
        logger.warning(f"email_triage tables unavailable (run docs/db/supabase_v3_4_email_triage.sql): {e}")
        _warned = True


# ─── Decisions ────────────────────────────────────────────────────────────

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
    """Insert a decision row; returns the stored row (always includes an id)."""
    row = {**rec, "id": str(uuid.uuid4()), "created_at": _now()}
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
        _mem_triage.append(row)  # process-local dedupe fallback
        return row


def update_decision(row_id: str, fields: Dict) -> None:
    for r in _mem_triage:
        if r.get("id") == row_id:
            r.update(fields)
    if _use_memory():
        return
    try:
        _sb().table("email_triage").update(fields).eq("id", row_id).execute()
    except Exception as e:
        _warn_once(e)


def list_pending(limit: int = 10) -> List[Dict]:
    if _use_memory():
        rows = [r for r in _mem_triage if r.get("decision") == "review" and not r.get("resolution")]
        return rows[-limit:]
    try:
        return (_sb().table("email_triage").select("*").eq("decision", "review").is_("resolution", "null")
                .order("created_at", desc=True).limit(limit).execute().data or [])
    except Exception as e:
        _warn_once(e)
        return [r for r in _mem_triage if r.get("decision") == "review" and not r.get("resolution")][-limit:]


def find_pending(short_id: str) -> Optional[Dict]:
    sid = (short_id or "").strip().lower()
    if not sid:
        return None
    for r in list_pending(50):
        if str(r.get("id", "")).lower().startswith(sid):
            return r
    return None


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


# ─── Stats ────────────────────────────────────────────────────────────────

def stats(days: int = 30) -> Dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    if _use_memory():
        rows = list(_mem_triage)
    else:
        try:
            rows = (_sb().table("email_triage").select("decision,category,layer,created_at")
                    .gte("created_at", since.isoformat()).limit(5000).execute().data or [])
        except Exception as e:
            _warn_once(e)
            rows = []
    out = {"total": len(rows), "decisions": {}, "categories": {}, "layers": {}, "days": days}
    for r in rows:
        for key, field in (("decisions", "decision"), ("categories", "category"), ("layers", "layer")):
            v = str(r.get(field))
            out[key][v] = out[key].get(v, 0) + 1
    return out
