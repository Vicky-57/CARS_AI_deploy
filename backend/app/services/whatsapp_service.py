"""
app/services/whatsapp_service.py
────────────────────────────────────────────────────────────────────────
WhatsApp transport layer (supports both Twilio WhatsApp Sandbox/Tryout and Meta Cloud API).

Only talks to Twilio / Meta. All business logic lives in whatsapp_handler.py.

  - send_whatsapp_message()  text / document (backwards compatible)
  - send_message()           text OR interactive buttons/list (fixed questions)
  - download_media()         fetch a customer's photo / PDF / voice note
  - verify_signature()       X-Hub-Signature-256 check for incoming Meta webhooks
  - collect_twilio_replies() context manager that captures replies during a Twilio
                             webhook turn so they can be returned as TwiML <Response>
  - DRY RUN mode             nothing is sent; messages are stored in OUTBOX
                             (used by tests and the local simulator)
────────────────────────────────────────────────────────────────────────
"""
import contextvars
import hashlib
import hmac
import logging
import re
from contextlib import contextmanager
from typing import Dict, List, Optional, Tuple
from xml.sax.saxutils import escape as xml_escape

import httpx

from config import settings

logger = logging.getLogger("whatsapp_service")

# Messages that would have been sent while in dry-run mode.
OUTBOX: List[Dict] = []

# Per-request collector used when replying synchronously to a Twilio webhook via TwiML.
_twilio_collector: contextvars.ContextVar[Optional[List[str]]] = contextvars.ContextVar(
    "_twilio_collector", default=None
)

Button = Tuple[str, str]  # (id, title) - title max 20 chars on WhatsApp


@contextmanager
def collect_twilio_replies():
    """Capture all outgoing WhatsApp messages in this async context for TwiML output."""
    bucket: List[str] = []
    token = _twilio_collector.set(bucket)
    try:
        yield bucket
    finally:
        _twilio_collector.reset(token)


def build_twiml(messages: List[str]) -> str:
    """Build a valid TwiML <Response> containing zero or more <Message> blocks."""
    inner = "".join(f"<Message>{xml_escape(m)}</Message>" for m in messages if m)
    return f'<?xml version="1.0" encoding="UTF-8"?><Response>{inner}</Response>'


def normalize_phone(phone: Optional[str]) -> str:
    """Digits only, no '+' or 'whatsapp:', e.g. 'whatsapp:+49 8404 938' -> '498404938'."""
    return re.sub(r"\D", "", phone or "")


def use_twilio() -> bool:
    """True when Twilio credentials are configured and not in dry-run mode."""
    return bool(
        not settings.WHATSAPP_DRY_RUN
        and settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_WHATSAPP_FROM
    )


def is_dry_run() -> bool:
    if settings.WHATSAPP_DRY_RUN:
        return True
    if use_twilio():
        return False
    token = settings.WHATSAPP_ACCESS_TOKEN
    return not token or token == "your_permanent_system_user_token_here"


def verify_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    """
    Validate Meta's X-Hub-Signature-256 header.
    If WHATSAPP_APP_SECRET is not configured (local dev) the check is skipped.
    """
    secret = settings.WHATSAPP_APP_SECRET
    if not secret:
        logger.warning("WHATSAPP_APP_SECRET not set - webhook signature NOT verified (dev mode only!)")
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.split("=", 1)[1])


def _api_url(path: str) -> str:
    return f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{path}"


def _headers() -> Dict[str, str]:
    return {"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}", "Content-Type": "application/json"}


async def _send_via_twilio(to_digits: str, body: str, media_url: Optional[str] = None) -> Dict:
    bucket = _twilio_collector.get()
    if bucket is not None:
        text_out = f"{body}\n{media_url}" if media_url else body
        bucket.append(text_out)
        logger.info(f"[TwiML] Queued reply for +{to_digits} ({len(text_out)} chars)")
        return {"status": "twiml_queued"}

    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    from_num = normalize_phone(settings.TWILIO_WHATSAPP_FROM)
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    form = {
        "From": f"whatsapp:+{from_num}",
        "To": f"whatsapp:+{to_digits}",
        "Body": body,
    }
    if media_url:
        form["MediaUrl"] = media_url
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(url, data=form, auth=(sid, token))
            res.raise_for_status()
            data = res.json()
            logger.info(f"Twilio WhatsApp sent to +{to_digits} (sid={data.get('sid')})")
            return data
    except Exception as e:
        logger.error(f"Failed to send Twilio WhatsApp to +{to_digits}: {e}")
        return {"status": "error", "message": str(e)}


async def _post_messages(payload: Dict) -> Dict:
    if is_dry_run():
        OUTBOX.append(payload)
        logger.info(f"[DRY-RUN] WhatsApp -> {payload.get('to')}: {payload.get('type')}")
        return {"status": "dry_run"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                _api_url(f"{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"),
                headers=_headers(),
                json=payload,
            )
            res.raise_for_status()
            return res.json()
    except Exception as e:
        logger.error(f"Failed to send WhatsApp to {payload.get('to')}: {e}")
        return {"status": "error", "message": str(e)}


async def send_whatsapp_message(to_phone: str, text: str, media_url: str = None) -> dict:
    """Send a plain text message, or a PDF/document when media_url is given."""
    to = normalize_phone(to_phone)
    if _twilio_collector.get() is not None or use_twilio():
        return await _send_via_twilio(to, text, media_url)
    if media_url:
        payload = {
            "messaging_product": "whatsapp", "to": to, "type": "document",
            "document": {"link": media_url, "caption": text, "filename": "CAR-AGENTS_Document.pdf"},
        }
    else:
        payload = {"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": text}}
    return await _post_messages(payload)


async def send_message(to_phone: str, text: str, buttons: Optional[List[Button]] = None) -> dict:
    """
    Send text, or an interactive message when buttons are provided.
    On Twilio Sandbox/Tryout, buttons are formatted as a numbered menu (1, 2, 3...)
    which whatsapp_flow.py natively accepts.
    """
    to = normalize_phone(to_phone)
    if not buttons:
        return await send_whatsapp_message(to, text)

    if _twilio_collector.get() is not None or use_twilio():
        options_txt = "\n".join(f"*{i}.* {title}" for i, (_, title) in enumerate(buttons, 1))
        full_text = f"{text}\n\n{options_txt}\n\n_(Reply with 1-{len(buttons)})_"
        return await _send_via_twilio(to, full_text)

    if len(buttons) <= 3:
        interactive = {
            "type": "button",
            "body": {"text": text[:1024]},
            "action": {"buttons": [
                {"type": "reply", "reply": {"id": bid, "title": title[:20]}} for bid, title in buttons
            ]},
        }
    else:
        interactive = {
            "type": "list",
            "body": {"text": text[:1024]},
            "action": {"button": "Auswahl / Choose", "sections": [{
                "title": "Optionen",
                "rows": [{"id": bid, "title": title[:24]} for bid, title in buttons[:10]],
            }]},
        }
    return await _post_messages({"messaging_product": "whatsapp", "to": to, "type": "interactive", "interactive": interactive})


async def download_media(media_id: str) -> Optional[Tuple[bytes, str]]:
    """
    Download an incoming media file.
    - If media_id is an https:// URL (Twilio MediaUrl0), downloads directly with Twilio auth.
    - Otherwise uses Meta's 2-step media download.
    Returns (bytes, mime_type) or None. Not available in dry-run mode.
    """
    if is_dry_run():
        logger.info("[DRY-RUN] download_media skipped")
        return None
    try:
        if media_id.startswith("http://") or media_id.startswith("https://"):
            auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN) if use_twilio() else None
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                res = await client.get(media_id, auth=auth)
                res.raise_for_status()
                return res.content, res.headers.get("content-type", "application/octet-stream")

        async with httpx.AsyncClient(timeout=30.0) as client:
            meta = await client.get(_api_url(media_id), headers=_headers())
            meta.raise_for_status()
            info = meta.json()
            file_res = await client.get(info["url"], headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"})
            file_res.raise_for_status()
            return file_res.content, info.get("mime_type", "application/octet-stream")
    except Exception as e:
        logger.error(f"download_media failed for {media_id}: {e}")
        return None
