"""
app/services/google_service.py
────────────────────────────────────────────────────────────────────────
Google OAuth2 Authentication & Token Refresh Engine
(Dedicated strictly to Google Drive Cloud Storage Integration)

Responsibilities:
  1. build_auth_url()       → OAuth consent URL for Google Drive scope
  2. exchange_code()        → Exchange OAuth auth code for tokens and persist to Supabase
  3. _get_valid_access_token() → Return refreshed Bearer token for Drive API calls
  4. is_connected()         → Check Google Drive connection status
  5. get_user_profile()     → Fetch connected user email and avatar
────────────────────────────────────────────────────────────────────────
"""
import urllib.parse
import urllib.request
import json
import base64
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict

from config import settings
from database import get_supabase

logger = logging.getLogger("google_service")

# The single row in the private google_auth table that holds Maxim's token
AUTH_ROW_ID = "maxim_main"


# ─── OAuth URL building ────────────────────────────────────────────────────────

def build_auth_url() -> str:
    """Build the Google OAuth consent URL strictly for Drive file access."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": settings.GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": "google-drive-sync",
    }
    return f"{settings.GOOGLE_AUTH_URI}?{urllib.parse.urlencode(params)}"


# ─── Token exchange & storage ─────────────────────────────────────────────────

def exchange_code(code: str) -> Dict:
    """Exchange the OAuth auth code for an access + refresh token."""
    payload = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    req = urllib.request.Request(
        settings.GOOGLE_TOKEN_URI,
        data=urllib.parse.urlencode(payload).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    _store_tokens(data)
    return data


def _store_tokens(token_data: Dict) -> None:
    """Persist the refresh token and access token to Supabase."""
    expires_at = datetime.utcnow() + timedelta(seconds=int(token_data.get("expires_in", 3600)))

    email = None
    name = None
    picture = None
    id_token = token_data.get("id_token")
    if id_token:
        try:
            parts = id_token.split(".")
            if len(parts) >= 2:
                padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
                payload = json.loads(base64.b64decode(padded).decode("utf-8"))
                email = payload.get("email")
                name = payload.get("name")
                picture = payload.get("picture")
        except Exception as e:
            logger.warning(f"Could not decode id_token: {e}")

    payload = {
        "id": AUTH_ROW_ID,
        "refresh_token": token_data.get("refresh_token"),
        "access_token": token_data.get("access_token"),
        "token_expiry": expires_at.isoformat(),
        "connected_at": datetime.utcnow().isoformat(),
    }
    if email:
        payload["email"] = email
    if name:
        payload["name"] = name
    if picture:
        payload["picture"] = picture

    try:
        sb = get_supabase()
        sb.table("google_auth").upsert(payload, on_conflict="id").execute()
    except Exception as db_err:
        logger.error(f"Error saving Google tokens to Supabase: {db_err}")


def _load_tokens() -> Optional[Dict]:
    """Load stored token row from Supabase."""
    try:
        sb = get_supabase()
        res = sb.table("google_auth").select("*").eq("id", AUTH_ROW_ID).single().execute()
        return res.data
    except Exception:
        return None


def is_connected() -> bool:
    """True if Google Drive is authorized."""
    tokens = _load_tokens()
    return bool(tokens and tokens.get("refresh_token"))


def get_user_profile() -> Optional[Dict]:
    """Return connected user profile."""
    tokens = _load_tokens()
    if tokens and tokens.get("email"):
        return {
            "email": tokens.get("email"),
            "name": tokens.get("name"),
            "picture": tokens.get("picture"),
        }
    return None


# ─── Access token management ──────────────────────────────────────────────────

def _get_valid_access_token() -> Optional[str]:
    """Return a valid access token, refreshing it if expired."""
    tokens = _load_tokens()
    if not tokens or not tokens.get("refresh_token"):
        return None

    expires_at = tokens.get("token_expiry")
    access_token = tokens.get("access_token")
    if access_token and expires_at:
        try:
            if datetime.utcnow() < datetime.fromisoformat(expires_at):
                return access_token
        except Exception:
            pass

    payload = {
        "refresh_token": tokens["refresh_token"],
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "grant_type": "refresh_token",
    }
    try:
        req = urllib.request.Request(
            settings.GOOGLE_TOKEN_URI,
            data=urllib.parse.urlencode(payload).encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        data["refresh_token"] = tokens["refresh_token"]
        _store_tokens(data)
        return data.get("access_token")
    except Exception as e:
        logger.error(f"Error refreshing Google Drive access token: {str(e)}")
        return None