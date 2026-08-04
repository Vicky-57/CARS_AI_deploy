"""
app/api/v1/endpoints/webhooks.py
────────────────────────────────────────────────────────────────────────
Meta WhatsApp Business Cloud API Webhook Handler (W2)

Handles:
  1. GET  /api/v1/webhooks/whatsapp — Meta Webhook Verification Challenge
  2. POST /api/v1/webhooks/whatsapp — Inbound Message Receiver
     - Parses incoming client WhatsApp messages
     - Runs Claude AI intent classification (BUY_INTENT / SELL_INTENT)
     - Saves communication log & creates/updates lead in Supabase
     - Drafts AI suggested reply
────────────────────────────────────────────────────────────────────────
"""
from fastapi import APIRouter, Request, Response, HTTPException, Query
from config import settings
from app.services.claude_service import classify_intent
from app.services.supabase_service import save_communication, create_lead, get_all_leads
from app.services.whatsapp_service import send_whatsapp_message
import json
import logging

logger = logging.getLogger("whatsapp_webhook")

router = APIRouter(prefix="/webhooks", tags=["WhatsApp Webhook"])


@router.get("/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """
    Meta Webhook Verification Endpoint.
    Meta sends a GET request when verifying the webhook URL in Meta Manager.
    """
    verify_token = settings.WHATSAPP_VERIFY_TOKEN or "car_agents_secret_token"
    
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        logger.info("WhatsApp Webhook verified successfully!")
        return Response(content=hub_challenge, media_type="text/plain")
    
    raise HTTPException(status_code=403, detail="Verification token mismatch")


@router.post("/whatsapp")
async def receive_whatsapp_message(request: Request):
    """
    Meta Webhook Inbound Message Receiver.
    Fires whenever a client sends a WhatsApp message to +49 8404 9385840.
    """
    try:
        data = await request.json()
        
        # Parse Meta webhook payload format
        entries = data.get("entry", [])
        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                messages = value.get("messages", [])
                contacts = value.get("contacts", [])
                
                if not messages:
                    continue
                
                msg = messages[0]
                from_phone = msg.get("from")  # E.164 phone number
                msg_type = msg.get("type")
                
                client_name = "WhatsApp Client"
                if contacts:
                    client_name = contacts[0].get("profile", {}).get("name", "WhatsApp Client")
                
                # Handle text messages
                if msg_type == "text":
                    body_text = msg.get("text", {}).get("body", "")
                    
                    # 1. Run Claude AI Intent Classification
                    ai_res = await classify_intent(body_text)
                    intent = ai_res.get("intent", "UNKNOWN")
                    ai_summary = ai_res.get("summary", "")
                    
                    # 2. Check if lead exists or create new in Supabase
                    existing_leads = get_all_leads()
                    matched_lead = next((l for l in existing_leads if l.get("phone") == from_phone), None)
                    lead_id = matched_lead.get("id") if matched_lead else None
                    
                    if not lead_id:
                        new_lead = create_lead({
                            "name": client_name,
                            "phone": from_phone,
                            "channel": "WHATSAPP",
                            "intent": "SELL" if intent == "SELL_INTENT" else "BUY" if intent == "BUY_INTENT" else "UNKNOWN",
                            "status": "NEW",
                            "message": body_text,
                            "notes": f"AI Summary: {ai_summary}"
                        })
                        lead_id = new_lead.get("id")
                    
                    # 3. Log communication entry into Supabase
                    save_communication({
                        "lead_id": lead_id,
                        "channel": "WHATSAPP",
                        "sender_name": client_name,
                        "sender_contact": from_phone,
                        "subject": "Inbound WhatsApp Message",
                        "body": body_text,
                        "is_inbound": True,
                        "intent": intent,
                        "ai_summary": ai_summary
                    })
                    
                    logger.info(f"Processed WhatsApp from {client_name} ({from_phone}): {intent}")

        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error processing WhatsApp webhook: {str(e)}")
        return {"status": "error", "message": str(e)}
