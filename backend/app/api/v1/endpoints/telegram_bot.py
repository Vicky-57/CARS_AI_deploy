"""
app/api/v1/endpoints/telegram_bot.py
────────────────────────────────────────────────────────────────────────
Telegram Master Agent Webhook & Polling Endpoint

  POST /telegram/webhook   → Receive updates from Telegram (webhook mode)
  POST /telegram/poll      → Manually trigger message polling (dev mode)
  GET  /telegram/status    → Check Telegram bot connection status
────────────────────────────────────────────────────────────────────────
"""
from fastapi import APIRouter, HTTPException, Request
from config import settings
from app.services.telegram_service import dispatch_telegram_command, send_telegram_message
import urllib.request
import json
import logging

logger = logging.getLogger("telegram_bot")
router = APIRouter(prefix="/telegram", tags=["Telegram Master Agent"])


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """
    Receive and process Telegram update messages sent via webhook.
    Register webhook URL at: https://api.telegram.org/bot{TOKEN}/setWebhook?url={URL}
    """
    try:
        body = await request.json()
        message = body.get("message") or body.get("edited_message")
        if message:
            await dispatch_telegram_command(message)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Telegram webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send")
async def send_message_to_maxim(text: str):
    """
    Manually push a notification/message to Maxim's Telegram chat.
    Useful for system alerts and triggered briefings from the portal.
    """
    if not settings.TELEGRAM_CHAT_ID:
        raise HTTPException(status_code=400, detail="TELEGRAM_CHAT_ID not configured in .env")
    result = await send_telegram_message(text)
    return {"ok": True, "result": result}


@router.get("/status")
async def telegram_status():
    """Check Telegram bot token and connection status."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return {"connected": False, "error": "TELEGRAM_BOT_TOKEN not set in .env"}

    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getMe"
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        bot = data.get("result", {})
        return {
            "connected": True,
            "bot_username": bot.get("username"),
            "bot_name": bot.get("first_name"),
            "chat_id_configured": bool(settings.TELEGRAM_CHAT_ID),
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}


@router.post("/set-webhook")
async def register_webhook(webhook_url: str):
    """
    Register this server's webhook URL with Telegram.
    Call once after deployment: webhook_url = https://yourserver.com/api/v1/telegram/webhook
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=400, detail="TELEGRAM_BOT_TOKEN not configured")

    payload = json.dumps({"url": webhook_url}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/setWebhook",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            result = json.loads(r.read())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
