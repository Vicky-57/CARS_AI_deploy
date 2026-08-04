import os
import json
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.services.gmail_api_service import (
    fetch_primary_unread_emails,
    convert_gmail_to_lead,
    TOKEN_FILE,
    SCOPES
)

router = APIRouter(prefix="/gmail", tags=["Google OAuth2 & Gmail API"])


class ConvertLeadRequest(BaseModel):
    message_id: str


@router.get("/auth-url")
def get_google_auth_url():
    """
    Returns the Google OAuth2 consent URL for the user to sign in with Google.
    No passwords required!
    """
    client_secrets_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "client_secrets.json"))

    if not os.path.exists(client_secrets_file):
        # Return structured guidance if client_secrets.json is not placed yet
        return {
            "status": "pending_setup",
            "auth_url": None,
            "message": "Please place your Google OAuth2 client_secrets.json in backend/ or set GOOGLE_CLIENT_ID in environment."
        }

    try:
        from google_auth_oauthlib.flow import Flow
        flow = Flow.from_client_secrets_file(
            client_secrets_file,
            scopes=SCOPES,
            redirect_uri="http://localhost:9000/api/v1/gmail/callback"
        )
        auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
        return {"status": "ready", "auth_url": auth_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/callback")
def google_oauth_callback(code: str = Query(...)):
    """
    Callback endpoint where Google redirects after the user clicks 'Allow' on Google permissions screen.
    Exchanges auth code for access & refresh tokens.
    """
    client_secrets_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "client_secrets.json"))
    try:
        from google_auth_oauthlib.flow import Flow
        flow = Flow.from_client_secrets_file(
            client_secrets_file,
            scopes=SCOPES,
            redirect_uri="http://localhost:9000/api/v1/gmail/callback"
        )
        flow.fetch_token(code=code)
        credentials = flow.credentials

        with open(TOKEN_FILE, 'w') as token_file:
            token_file.write(credentials.to_json())

        return {"status": "success", "message": "Google Account connected successfully! You can close this window."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")


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
