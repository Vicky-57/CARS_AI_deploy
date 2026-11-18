"""
app/api/v1/endpoints/webhooks.py
────────────────────────────────────────────────────────────────────────
WhatsApp Webhook Handler (supports both Twilio WhatsApp Sandbox/Tryout and Meta Cloud API).

  GET  /api/v1/webhooks/whatsapp         - Meta verification handshake
  POST /api/v1/webhooks/whatsapp         - Incoming messages (auto-detects Meta JSON or Twilio Form)
  POST /api/v1/webhooks/whatsapp/twilio  - Explicit Twilio WhatsApp webhook (returns TwiML <Response>)
  GET  /api/v1/webhooks/whatsapp/status  - Config checklist for go-live
────────────────────────────────────────────────────────────────────────
"""
import json
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, Response

from config import settings
from app.services.whatsapp_handler import handle_twilio_payload, handle_webhook_payload, owner_phones
from app.services.whatsapp_service import (
    build_twiml,
    collect_twilio_replies,
    is_dry_run,
    use_twilio,
    verify_signature,
)

logger = logging.getLogger("whatsapp_webhook")

router = APIRouter(prefix="/webhooks", tags=["WhatsApp Webhook"])


@router.get("/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta calls this once when the webhook URL is saved in the Meta dashboard."""
    verify_token = settings.WHATSAPP_VERIFY_TOKEN
    if not verify_token:
        raise HTTPException(status_code=503, detail="WHATSAPP_VERIFY_TOKEN is not configured")
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        logger.info("WhatsApp webhook verified")
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification token mismatch")


@router.post("/whatsapp/twilio")
async def receive_twilio_whatsapp(request: Request):
    """Twilio WhatsApp webhook (form-encoded). Runs handler and returns TwiML <Response><Message>..."""
    form = dict(await request.form())
    from_phone = form.get("From")
    with collect_twilio_replies(target_phone=from_phone) as replies:
        await handle_twilio_payload(form)
    return Response(content=build_twiml(replies), media_type="text/xml")


@router.post("/whatsapp")
async def receive_whatsapp_message(request: Request, background_tasks: BackgroundTasks):
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = dict(await request.form())
        from_phone = form.get("From")
        with collect_twilio_replies(target_phone=from_phone) as replies:
            await handle_twilio_payload(form)
        return Response(content=build_twiml(replies), media_type="text/xml")

    raw = await request.body()
    if not verify_signature(raw, request.headers.get("X-Hub-Signature-256")):
        logger.warning("Rejected WhatsApp webhook: bad signature")
        raise HTTPException(status_code=403, detail="Invalid signature")
    try:
        data = json.loads(raw or b"{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    background_tasks.add_task(handle_webhook_payload, data)
    return {"status": "received"}


@router.get("/whatsapp/status")
async def whatsapp_status():
    """Go-live checklist (no secrets are returned)."""
    return {
        "dry_run": is_dry_run(),
        "provider": "twilio" if use_twilio() else "meta",
        "twilio_configured": use_twilio(),
        "access_token_set": bool(settings.WHATSAPP_ACCESS_TOKEN),
        "phone_number_id_set": bool(settings.WHATSAPP_PHONE_NUMBER_ID),
        "verify_token_set": bool(settings.WHATSAPP_VERIFY_TOKEN),
        "app_secret_set": bool(settings.WHATSAPP_APP_SECRET),
        "owner_numbers_configured": len(owner_phones()),
    }
