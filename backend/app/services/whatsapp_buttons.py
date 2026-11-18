"""
app/services/whatsapp_buttons.py
────────────────────────────────────────────────────────────────────────
Twilio Content API button / list-picker registry for interactive WhatsApp
messages.

Note on Twilio Trial Sandbox:
  Twilio's Content API (`/v1/Content`) returns 401 (code 20003) on Trial
  accounts. When `TWILIO_CONTENT_ENABLED=False` (default for Trial Sandbox)
  or when Twilio returns 401/403/20003, `try_send_twilio_buttons` immediately
  returns False so `whatsapp_service.send_message` falls back to numbered text
  options (`*1.*`, `*2.*`, ...) without breaking or slowing down replies.

  Once the Twilio account is upgraded, set `TWILIO_CONTENT_ENABLED=true`
  to automatically create, cache, and send native quick-reply buttons (<=3)
  and list-pickers (4..10) with zero code changes.
────────────────────────────────────────────────────────────────────────
"""
import hashlib
import json
import logging
from typing import Dict, List, Optional, Sequence, Tuple, Union

import httpx

from config import settings

logger = logging.getLogger("whatsapp_buttons")

ButtonItem = Union[Tuple[str, str], Tuple[str, str, str]]

_CONTENT_CACHE: Dict[str, str] = {}
_CONTENT_API_BLOCKED = False


def normalize_button(item: ButtonItem) -> Tuple[str, str, str]:
    """Coerce 2-tuple or 3-tuple button definition to (id, title, description)."""
    if len(item) >= 3:
        return str(item[0]), str(item[1]), str(item[2] or "")
    return str(item[0]), str(item[1]), ""


def _signature(items: Sequence[Tuple[str, str, str]]) -> str:
    raw = "|".join(f"{bid}:{title}:{desc}" for bid, title, desc in items)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]
    kind = "qr" if len(items) <= 3 else "lp"
    return f"ca_{kind}_{digest}"


def _build_content_payload(friendly_name: str, items: Sequence[Tuple[str, str, str]]) -> Dict:
    if len(items) <= 3:
        return {
            "friendly_name": friendly_name,
            "language": "en",
            "variables": {"1": "Choose an option"},
            "types": {
                "twilio/quick-reply": {
                    "body": "{{1}}",
                    "actions": [{"id": bid[:64], "title": title[:20]} for bid, title, _ in items],
                }
            },
        }
    return {
        "friendly_name": friendly_name,
        "language": "en",
        "variables": {"1": "Choose an option"},
        "types": {
            "twilio/list-picker": {
                "body": "{{1}}",
                "button": "Auswahl / Choose",
                "items": [
                    {
                        "id": bid[:64],
                        "item": title[:24],
                        "description": (desc or title)[:72],
                    }
                    for bid, title, desc in items[:10]
                ],
            }
        },
    }


async def _ensure_content_sid(items: Sequence[Tuple[str, str, str]]) -> Optional[str]:
    global _CONTENT_API_BLOCKED
    if _CONTENT_API_BLOCKED or not getattr(settings, "TWILIO_CONTENT_ENABLED", False):
        return None

    name = _signature(items)
    if name in _CONTENT_CACHE:
        return _CONTENT_CACHE[name]

    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    if not sid or not token:
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if not _CONTENT_CACHE:
                r_list = await client.get("https://content.twilio.com/v1/Content?PageSize=50", auth=(sid, token))
                if r_list.status_code in (401, 403):
                    _CONTENT_API_BLOCKED = True
                    logger.warning("Twilio Content API unavailable (Trial/401); using numbered menu fallback.")
                    return None
                if r_list.status_code == 200:
                    for c in r_list.json().get("contents", []):
                        if c.get("friendly_name") and c.get("sid"):
                            _CONTENT_CACHE[c["friendly_name"]] = c["sid"]
                    if name in _CONTENT_CACHE:
                        return _CONTENT_CACHE[name]

            payload = _build_content_payload(name, items)
            r_create = await client.post("https://content.twilio.com/v1/Content", json=payload, auth=(sid, token))
            if r_create.status_code in (401, 403):
                _CONTENT_API_BLOCKED = True
                logger.warning("Twilio Content API create rejected (Trial/401); using numbered menu fallback.")
                return None
            r_create.raise_for_status()
            csid = r_create.json().get("sid")
            if csid:
                _CONTENT_CACHE[name] = csid
            return csid
    except Exception as e:
        logger.warning(f"Twilio Content template resolution failed: {e}")
        return None


async def try_send_twilio_buttons(to_digits: str, body_text: str, buttons: Sequence[ButtonItem]) -> Optional[Dict]:
    """
    Attempt to send native Twilio interactive buttons via Content API.
    Returns Twilio API response dict on success, or None if unavailable/failed
    (caller should then fall back to numbered options).
    """
    if not buttons or _CONTENT_API_BLOCKED or not getattr(settings, "TWILIO_CONTENT_ENABLED", False):
        return None

    items = [normalize_button(b) for b in buttons[:10]]
    csid = await _ensure_content_sid(items)
    if not csid:
        return None

    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    from_raw = settings.TWILIO_WHATSAPP_FROM or ""
    from_digits = "".join(ch for ch in from_raw if ch.isdigit())
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    form = {
        "From": f"whatsapp:+{from_digits}",
        "To": f"whatsapp:+{to_digits}",
        "ContentSid": csid,
        "ContentVariables": json.dumps({"1": body_text[:1024]}),
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, data=form, auth=(sid, token))
            res.raise_for_status()
            return res.json()
    except Exception as e:
        logger.warning(f"Twilio Content button send failed ({csid}), falling back to text: {e}")
        return None
