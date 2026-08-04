"""
app/api/v1/endpoints/google_auth.py
────────────────────────────────────────────────────────────────────────
Google OAuth endpoints for Unified Workspace (Gmail, Drive, Calendar):
  GET  /auth/google/url       → consent URL
  GET  /auth/google/callback  → receive code, store tokens
  GET  /auth/google/status    → status & connected email profile
────────────────────────────────────────────────────────────────────────
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from config import settings
from app.services.google_service import build_auth_url, exchange_code, is_connected, get_user_profile

router = APIRouter(prefix="/auth/google", tags=["Google OAuth"])


@router.get("/url")
async def google_auth_url():
    """Return the unified Google consent URL."""
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

    # Redirect back to the frontend profile page with success marker
    return RedirectResponse(url="http://localhost:5173/profile?google=connected")


@router.get("/status")
async def google_auth_status():
    """Return connection status and the authenticated user's email."""
    connected = is_connected()
    profile = get_user_profile() if connected else None
    return {
        "connected": connected,
        "email": profile.get("email") if profile else None,
        "name": profile.get("name") if profile else None,
        "picture": profile.get("picture") if profile else None
    }
