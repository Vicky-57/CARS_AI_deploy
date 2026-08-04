"""
app/services/gmail_api_service.py
────────────────────────────────────────────────────────────────────────
Gmail REST API Service — reads tokens from Supabase google_auth table
(same table populated by the Google OAuth callback in google_service.py)

Does NOT use google_tokens.json or any local file.
────────────────────────────────────────────────────────────────────────
"""
import base64
import logging
import json
import urllib.request
import urllib.parse

from app.services.google_service import _get_valid_access_token
from config import settings

logger = logging.getLogger("gmail_api_service")

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"


def _gmail_get(path: str, params: dict = None) -> dict:
    """Authenticated GET to Gmail REST API."""
    token = _get_valid_access_token()
    if not token:
        raise PermissionError("Google not connected. Please authorize via Settings → App Connections.")
    url = f"{GMAIL_API_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _extract_body(payload: dict) -> str:
    """Recursively extract plain-text body from a Gmail message payload."""
    mime = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")

    if mime == "text/plain" and body_data:
        return base64.urlsafe_b64decode(body_data + "==").decode("utf-8", errors="ignore")

    for part in payload.get("parts", []):
        text = _extract_body(part)
        if text:
            return text
    return ""


async def fetch_primary_unread_emails(limit: int = 20) -> list:
    """
    Queries Gmail REST API for Primary Inbox messages.
    Uses tokens stored in Supabase google_auth table.
    """
    token = _get_valid_access_token()
    if not token:
        logger.warning("Google OAuth not connected yet — no token in Supabase google_auth.")
        return []

    try:
        # List messages in Primary category inbox
        list_data = _gmail_get("/users/me/messages", {
            "q": "category:primary in:inbox",
            "maxResults": limit
        })

        messages = list_data.get("messages", [])
        if not messages:
            logger.info("No primary inbox messages found.")
            return []

        email_list = []
        for m in messages:
            try:
                msg = _gmail_get(f"/users/me/messages/{m['id']}", {"format": "full"})
                headers = msg.get("payload", {}).get("headers", [])

                subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "(No Subject)")
                sender = next((h["value"] for h in headers if h["name"].lower() == "from"), "Unknown")
                date = next((h["value"] for h in headers if h["name"].lower() == "date"), "")

                snippet = msg.get("snippet", "")
                body = _extract_body(msg.get("payload", {})) or snippet

                # Parse "Name <email>" format
                if "<" in sender:
                    sender_name = sender.split("<")[0].strip().strip('"')
                    sender_email = sender.split("<")[-1].replace(">", "").strip()
                else:
                    sender_name = sender
                    sender_email = sender

                email_list.append({
                    "message_id": m["id"],
                    "sender_name": sender_name,
                    "sender_email": sender_email,
                    "subject": subject,
                    "snippet": snippet,
                    "body": body[:2000],
                    "date": date,
                })
            except Exception as e:
                logger.error(f"Error fetching message {m['id']}: {e}")
                continue

        logger.info(f"Fetched {len(email_list)} primary inbox emails via Gmail REST API.")
        return email_list

    except PermissionError as e:
        logger.warning(str(e))
        return []
    except Exception as e:
        logger.error(f"Gmail REST API error: {e}")
        return []


async def convert_gmail_to_lead(message_id: str) -> dict:
    """
    Takes a Gmail message ID, fetches full content, runs Claude AI intent extraction,
    and creates a lead in Supabase.
    """
    token = _get_valid_access_token()
    if not token:
        return {"success": False, "error": "Google not connected. Please authorize via Settings."}

    try:
        from app.services.claude_service import summarize_email
        from app.services.supabase_service import create_lead, save_communication, get_all_leads

        msg = _gmail_get(f"/users/me/messages/{message_id}", {"format": "full"})
        headers = msg.get("payload", {}).get("headers", [])

        subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "")
        sender = next((h["value"] for h in headers if h["name"].lower() == "from"), "")

        if "<" in sender:
            sender_name = sender.split("<")[0].strip().strip('"')
            sender_email = sender.split("<")[-1].replace(">", "").strip()
        else:
            sender_name = sender
            sender_email = sender

        snippet = msg.get("snippet", "")
        body = _extract_body(msg.get("payload", {})) or snippet

        # Claude AI intent classification
        ai_res = await summarize_email(subject, body[:1000])
        intent = ai_res.get("intent", "UNKNOWN")
        summary = ai_res.get("summary", "")

        # Avoid duplicate leads
        existing = get_all_leads()
        matched = next((l for l in existing if l.get("email") == sender_email), None)

        if not matched:
            new_lead = create_lead({
                "name": sender_name,
                "email": sender_email,
                "channel": "GMAIL_API",
                "intent": "SELL" if intent == "SELL_INTENT" else "BUY" if intent == "BUY_INTENT" else "UNKNOWN",
                "status": "NEW",
                "message": f"Subject: {subject}\n\n{body[:500]}",
                "notes": f"AI Summary: {summary}"
            })
            lead_id = new_lead.get("id")
        else:
            lead_id = matched.get("id")

        save_communication({
            "lead_id": lead_id,
            "channel": "GMAIL_API",
            "sender_name": sender_name,
            "sender_contact": sender_email,
            "subject": subject,
            "body": snippet,
            "is_inbound": True,
            "intent": intent,
            "ai_summary": summary
        })

        return {
            "success": True,
            "lead_id": lead_id,
            "intent": intent,
            "summary": summary,
            "message": f"Successfully converted email from {sender_name} into a Lead!"
        }
    except Exception as e:
        logger.error(f"Error converting Gmail to lead: {e}")
        return {"success": False, "error": str(e)}
