"""
app/api/v1/endpoints/google_auth.py
────────────────────────────────────────────────────────────────────────
Google Calendar OAuth endpoints:
  GET  /auth/google/url       → consent URL for Maxim
  GET  /auth/google/callback  → receive code, store token
  GET  /auth/google/status    → is the calendar connected?
────────────────────────────────────────────────────────────────────────
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from config import settings
from app.services.google_service import build_auth_url, exchange_code, is_connected

router = APIRouter(prefix="/auth/google", tags=["Google Calendar Auth"])


@router.get("/url")
async def google_auth_url():
    """Return the Google consent URL Maxim must open once."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google OAuth credentials not configured in .env")
    return {"url": build_auth_url()}


@router.get("/callback")
async def google_auth_callback(code: str = Query(None), error: str = Query(None)):
    """Handle Google's redirect after consent. Stores the refresh token."""
    if error:
        raise HTTPException(status_code=400, detail=f"Google auth error: {error}")
    if not code:
        raise HTTPException(status_code=400, detail="Missing auth code")

    try:
        exchange_code(code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {str(e)}")

    # Redirect back to the frontend calendar page with success marker
    return RedirectResponse(url="http://localhost:5173/calendar?google=connected")


@router.get("/status")
async def google_auth_status():
    """Return whether Google Calendar is connected."""
    return {"connected": is_connected()}
