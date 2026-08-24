import os
import json
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from config import settings
from app.services.google_service import build_auth_url, exchange_code, is_connected
from app.services.gmail_api_service import (
    fetch_primary_unread_emails,
    convert_gmail_to_lead
)

router = APIRouter(prefix="/gmail", tags=["Google OAuth2 & Gmail API"])


class ConvertLeadRequest(BaseModel):
    message_id: str


@router.get("/auth-url")
def get_google_auth_url():
    """
    Returns the Google OAuth2 consent URL for the user to sign in with Google.
    Unifies Gmail, Google Drive, and Google Calendar permissions!
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return {
            "status": "pending_credentials",
            "auth_url": None,
            "message": "Please enter your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env to enable 1-click Google permission!"
        }

    try:
        url = build_auth_url()
        return {"status": "ready", "auth_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/primary-emails")
async def get_primary_emails(limit: int = 15):
    """
    Fetches Primary Inbox emails directly from Gmail REST API (no IMAP/SMTP!).
    Filters for category:primary messages only.
    """
    emails = await fetch_primary_unread_emails(limit=limit)
    return {"status": "success", "count": len(emails), "emails": emails}


@router.post("/convert-lead")
async def convert_email_to_lead_action(req: ConvertLeadRequest):
    """
    1-Click UI Action: Converts a primary email into a Lead in Supabase with Claude AI extraction!
    """
    res = await convert_gmail_to_lead(req.message_id)
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Conversion failed"))
    return res
