"""
app/services/whatsapp_service.py
────────────────────────────────────────────────────────────────────────
WhatsApp Cloud API Integration Service
Used for sending WhatsApp messages, PDF contracts, and executive briefings.
────────────────────────────────────────────────────────────────────────
"""
import httpx
from config import settings
import logging

logger = logging.getLogger("whatsapp_service")


async def send_whatsapp_message(to_phone: str, text: str, media_url: str = None) -> dict:
    """
    Sends a WhatsApp message via Meta Cloud API to a recipient phone number.

    Args:
        to_phone:  Recipient phone in E.164 format e.g. +4984049385840
        text:      Message body text
        media_url: Optional PDF/Image link to attach
    """
    token = settings.WHATSAPP_ACCESS_TOKEN
    phone_id = settings.WHATSAPP_PHONE_NUMBER_ID

    if not token or token == "your_permanent_system_user_token_here":
        logger.warning("WhatsApp credentials not configured in .env. Message skipped.")
        return {"status": "skipped", "reason": "Missing Meta Access Token"}

    url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    if media_url:
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone.replace(" ", "").replace("-", ""),
            "type": "document",
            "document": {
                "link": media_url,
                "caption": text,
                "filename": "CAR-AGENTS_Document.pdf"
            }
        }
    else:
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone.replace(" ", "").replace("-", ""),
            "type": "text",
            "text": {"body": text}
        }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            logger.info(f"WhatsApp sent successfully to {to_phone}")
            return res.json()
    except Exception as e:
        logger.error(f"Failed to send WhatsApp to {to_phone}: {str(e)}")
        return {"status": "error", "message": str(e)}
