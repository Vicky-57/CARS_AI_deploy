"""
app/services/gmail_api_service.py
────────────────────────────────────────────────────────────────────────
Google OAuth2 & Official Gmail REST API Service (No IMAP/SMTP passwords!)

Uses Official Google APIs:
  - Gmail API v1 (users.messages.list, users.messages.get, users.messages.send)
  - Filters strictly for `label:INBOX category:primary is:unread`
  - 1-Click Convert Email to Lead with Claude AI assistance
────────────────────────────────────────────────────────────────────────
"""
import os
import base64
import logging
import json
from config import settings
from app.services.claude_service import summarize_email
from app.services.supabase_service import create_lead, save_communication, get_all_leads

logger = logging.getLogger("gmail_api_service")

# Google Scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/drive.file'
]

TOKEN_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "google_tokens.json"))


def get_gmail_service():
    """
    Returns an authorized Gmail API service instance using saved OAuth2 tokens.
    """
    if not os.path.exists(TOKEN_FILE):
        return None

    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        if creds and creds.valid:
            return build('gmail', 'v1', credentials=creds)
        elif creds and creds.expired and creds.refresh_token:
            from google.auth.transport.requests import Request
            creds.refresh(Request())
            with open(TOKEN_FILE, 'w') as token:
                token.write(creds.to_json())
            return build('gmail', 'v1', credentials=creds)
    except Exception as e:
        logger.error(f"Error initializing Gmail API service: {str(e)}")
    return None


async def fetch_primary_unread_emails(limit: int = 15) -> list:
    """
    Queries official Gmail REST API for primary unread inbox messages.
    Filter query: `label:INBOX category:primary`
    """
    service = get_gmail_service()
    if not service:
        logger.warning("Gmail API Service not authorized yet. Please complete Google Login.")
        return []

    try:
        # Search for primary category messages only
        results = service.users().messages().list(
            userId='me',
            q='label:INBOX category:primary',
            maxResults=limit
        ).execute()

        messages = results.get('messages', [])
        email_list = []

        for m in messages:
            msg = service.users().messages().get(userId='me', id=m['id'], format='full').execute()
            headers = msg.get('payload', {}).get('headers', [])
            
            subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), '(No Subject)')
            sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unknown Sender')
            date = next((h['value'] for h in headers if h['name'].lower() == 'date'), '')

            snippet = msg.get('snippet', '')
            
            # Extract plain text body if available
            body = snippet
            parts = msg.get('payload', {}).get('parts', [])
            for p in parts:
                if p.get('mimeType') == 'text/plain':
                    data = p.get('body', {}).get('data', '')
                    if data:
                        body = base64.urlsafe_b64decode(data.encode('ASCII')).decode('utf-8', errors='ignore')
                        break

            clean_sender_email = sender.split("<")[-1].replace(">", "").strip() if "<" in sender else sender
            sender_name = sender.split("<")[0].strip() if "<" in sender else sender

            email_list.append({
                "message_id": m['id'],
                "sender_name": sender_name,
                "sender_email": clean_sender_email,
                "subject": subject,
                "snippet": snippet,
                "body": body,
                "date": date,
            })

        return email_list
    except Exception as e:
        logger.error(f"Error fetching Gmail API messages: {str(e)}")
        return []


async def convert_gmail_to_lead(message_id: str) -> dict:
    """
    Takes a Gmail message ID, fetches full content, runs Claude AI intent & spec extraction,
    and creates a lead in Supabase!
    """
    service = get_gmail_service()
    if not service:
        return {"success": False, "error": "Gmail API not authenticated"}

    try:
        msg = service.users().messages().get(userId='me', id=message_id, format='full').execute()
        headers = msg.get('payload', {}).get('headers', [])
        
        subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), '')
        sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), '')
        
        clean_email = sender.split("<")[-1].replace(">", "").strip() if "<" in sender else sender
        sender_name = sender.split("<")[0].strip() if "<" in sender else sender

        snippet = msg.get('snippet', '')

        # Summarise email using Claude
        ai_res = await summarize_email(subject, snippet)
        intent = ai_res.get("intent", "UNKNOWN")
        summary = ai_res.get("summary", "")

        # Check existing leads
        existing = get_all_leads()
        matched = next((l for l in existing if l.get("email") == clean_email), None)

        if not matched:
            new_lead = create_lead({
                "name": sender_name,
                "email": clean_email,
                "channel": "GMAIL_API",
                "intent": "SELL" if intent == "SELL_INTENT" else "BUY" if intent == "BUY_INTENT" else "UNKNOWN",
                "status": "NEW",
                "message": f"Subject: {subject}\n\n{snippet}",
                "notes": f"AI Summary: {summary}"
            })
            lead_id = new_lead.get("id")
        else:
            lead_id = matched.get("id")

        save_communication({
            "lead_id": lead_id,
            "channel": "GMAIL_API",
            "sender_name": sender_name,
            "sender_contact": clean_email,
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
        logger.error(f"Error converting Gmail to lead: {str(e)}")
        return {"success": False, "error": str(e)}
