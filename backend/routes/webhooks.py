from fastapi import APIRouter, Request, HTTPException, Query
from config import settings
from services import supabase_service as db, claude_service
from datetime import datetime
import hashlib

router = APIRouter(prefix="/webhook", tags=["Webhooks"])


@router.get("/whatsapp")
async def whatsapp_verify(request: Request):
    """Meta WhatsApp Cloud API webhook verification endpoint."""
    params = dict(request.query_params)
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    if mode == "subscribe" and token == settings.WHATSAPP_VERIFY_TOKEN:
        return int(challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/whatsapp")
async def whatsapp_inbound(request: Request):
    """Receive inbound WhatsApp messages from Meta Cloud API."""
    try:
        body = await request.json()
        entry = body.get("entry", [])[0]
        changes = entry.get("changes", [])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        for msg in messages:
            phone = msg.get("from", "")
            text = ""
            msg_type = msg.get("type", "text")
            if msg_type == "text":
                text = msg.get("text", {}).get("body", "")
            elif msg_type == "audio":
                text = "[Audio message — transcription pending]"

            if not text:
                continue

            # Classify intent via Claude
            classification = await claude_service.classify_intent(text)
            intent = classification.get("intent", "UNKNOWN")

            # Check if lead already exists for this phone number
            existing_leads = db.get_all_leads(limit=10)
            existing = next((l for l in existing_leads if l.get("phone") == phone), None)
            lead_id = existing["id"] if existing else None

            if not lead_id:
                # Auto-create lead
                new_lead = db.create_lead({
                    "name": f"WhatsApp: {phone}",
                    "phone": phone,
                    "channel": "WHATSAPP",
                    "intent": intent,
                    "status": "NEW",
                })
                lead_id = new_lead.get("id")

            # Save communication record
            db.save_communication({
                "lead_id": lead_id,
                "channel": "WHATSAPP",
                "sender_name": phone,
                "sender_contact": phone,
                "body": text,
                "is_inbound": True,
                "intent": intent,
                "ai_summary": classification.get("summary", ""),
                "timestamp": datetime.utcnow().isoformat(),
            })

    except Exception as e:
        # Never return 5xx to Meta or they'll keep retrying
        print(f"WhatsApp webhook error: {e}")

    return {"status": "ok"}


@router.post("/email")
async def email_inbound(request: Request):
    """Receive inbound email via n8n forward or direct SMTP webhook."""
    try:
        body = await request.json()
        sender = body.get("from", "")
        subject = body.get("subject", "")
        text = body.get("body", "")

        if not sender or not text:
            return {"status": "skipped"}

        # Classify intent
        analysis = await claude_service.summarize_email(subject, text)
        intent = analysis.get("intent", "UNKNOWN")

        # Check if lead already exists for this email
        existing_leads = db.get_all_leads(limit=200)
        existing = next((l for l in existing_leads if l.get("email") == sender), None)
        lead_id = existing["id"] if existing else None

        if not lead_id:
            new_lead = db.create_lead({
                "name": body.get("sender_name", sender),
                "email": sender,
                "channel": "EMAIL",
                "intent": intent,
                "status": "NEW",
            })
            lead_id = new_lead.get("id")

        db.save_communication({
            "lead_id": lead_id,
            "channel": "EMAIL",
            "sender_name": body.get("sender_name", sender),
            "sender_contact": sender,
            "subject": subject,
            "body": text,
            "is_inbound": True,
            "intent": intent,
            "ai_summary": analysis.get("summary", ""),
            "timestamp": datetime.utcnow().isoformat(),
        })

    except Exception as e:
        print(f"Email webhook error: {e}")

    return {"status": "ok"}
