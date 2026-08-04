"""
app/services/google_service.py
────────────────────────────────────────────────────────────────────────
Google Calendar OAuth + Calendar API Service.

Responsibilities:
  1. /auth/google/url     → build the Google OAuth consent URL for Maxim
  2. /auth/google/callback→ exchange the auth code for tokens and store
                            the refresh token in a private Supabase table
  3. Credential building   → rebuild an authorised client from the stored token
  4. Calendar operations   → create / update / delete events + free/busy check
────────────────────────────────────────────────────────────────────────
"""
import urllib.parse
import urllib.request
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, List

from config import settings
from database import get_supabase

# The single row in the private google_auth table that holds Maxim's token
AUTH_ROW_ID = "maxim_main"

CALENDAR_SCOPES = settings.GOOGLE_SCOPES.split()


# ─── OAuth URL building ────────────────────────────────────────────────────────

def build_auth_url() -> str:
    """Build the Google OAuth consent URL Maxim must open once."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": settings.GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": "calendar-sync",
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
    """Persist the refresh token (and any short-lived access token) to Supabase."""
    expires_at = datetime.utcnow() + timedelta(seconds=int(token_data.get("expires_in", 3600)))
    payload = {
        "id": AUTH_ROW_ID,
        "refresh_token": token_data.get("refresh_token"),
        "access_token": token_data.get("access_token"),
        "token_expiry": expires_at.isoformat(),
        "connected_at": datetime.utcnow().isoformat(),
    }
    sb = get_supabase()
    sb.table("google_auth").upsert(payload, on_conflict="id").execute()


def _load_tokens() -> Optional[Dict]:
    """Load the stored token row from Supabase."""
    try:
        sb = get_supabase()
        res = sb.table("google_auth").select("*").eq("id", AUTH_ROW_ID).single().execute()
        return res.data
    except Exception:
        return None


def is_connected() -> bool:
    """True if Maxim has connected Google Calendar before."""
    return bool(_load_tokens() and _load_tokens().get("refresh_token"))


# ─── Access token management ──────────────────────────────────────────────────

def _get_valid_access_token() -> Optional[str]:
    """Return a valid access token, refreshing it if expired."""
    tokens = _load_tokens()
    if not tokens or not tokens.get("refresh_token"):
        return None

    expires_at = tokens.get("token_expiry")
    access_token = tokens.get("access_token")
    # If we have an access token that is still valid, reuse it
    if access_token and expires_at:
        try:
            if datetime.utcnow() < datetime.fromisoformat(expires_at):
                return access_token
        except Exception:
            pass

    # Otherwise refresh it
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
        data["refresh_token"] = tokens["refresh_token"]  # keep the persistent one
        _store_tokens(data)
        return data.get("access_token")
    except Exception:
        return None


def _authorized_headers() -> Optional[Dict]:
    """Return request headers with a valid Bearer token, or None."""
    token = _get_valid_access_token()
    if not token:
        return None
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


# ─── Google Calendar API call helpers ─────────────────────────────────────────

def _api_build(path: str, method: str, body: Optional[Dict] = None, query: Optional[str] = None) -> Dict:
    """Generic authenticated call to the Google Calendar v3 API."""
    headers = _authorized_headers()
    if not headers:
        raise PermissionError("Google Calendar is not connected yet.")

    url = f"https://www.googleapis.com/calendar/v3/{path}"
    if query:
        url = f"{url}?{query}"

    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def _api_send(path: str, method: str, body: Optional[Dict] = None) -> Dict:
    """Call Google API for send-requests, returning empty dict on 204 (no content)."""
    headers = _authorized_headers()
    if not headers:
        raise PermissionError("Google Calendar is not connected yet.")

    url = f"https://www.googleapis.com/calendar/v3/{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return {}


def _event_body(title: str, client_name: str, start_iso: str, end_iso: str,
                location: Optional[str] = None, notes: Optional[str] = None) -> Dict:
    """Build a Google Calendar event resource from meeting data."""
    return {
        "summary": title,
        "description": f"Client: {client_name}" + (f"\n{notes}" if notes else ""),
        "location": location or "",
        "start": {"dateTime": start_iso, "timeZone": "UTC"},
        "end": {"dateTime": end_iso, "timeZone": "UTC"},
    }


# ─── Calendar operations ──────────────────────────────────────────────────────

def create_event(meeting: Dict) -> str:
    """Create a Google Calendar event, returning its event id."""
    body = _event_body(
        title=meeting.get("title", "Meeting"),
        client_name=meeting.get("client_name", ""),
        start_iso=meeting["start_time"],
        end_iso=meeting["end_time"],
        location=meeting.get("location_address"),
        notes=meeting.get("notes"),
    )
    result = _api_build(f"calendars/{settings.GOOGLE_CALENDAR_ID}/events", "POST", body)
    return result.get("id", "")


def update_event(event_id: str, meeting: Dict) -> None:
    """Update an existing Google Calendar event."""
    body = _event_body(
        title=meeting.get("title", "Meeting"),
        client_name=meeting.get("client_name", ""),
        start_iso=meeting["start_time"],
        end_iso=meeting["end_time"],
        location=meeting.get("location_address"),
        notes=meeting.get("notes"),
    )
    _api_build(f"calendars/{settings.GOOGLE_CALENDAR_ID}/events/{event_id}", "PUT", body)


def delete_event(event_id: str) -> None:
    """Delete a Google Calendar event."""
    _api_send(f"calendars/{settings.GOOGLE_CALENDAR_ID}/events/{event_id}", "DELETE")


def check_free_busy(start_iso: str, end_iso: str) -> List[Dict]:
    """
    Get busy windows from Maxim's primary calendar for a time range.
    Returns a list of {start, end, event_id} busy slots.
    """
    body = {
        "timeMin": start_iso,
        "timeMax": end_iso,
        "timeZone": "UTC",
        "items": [{"id": settings.GOOGLE_CALENDAR_ID}],
    }
    result = _api_build("freeBusy", "POST", body)
    cal_busy = result.get("calendars", {}).get(settings.GOOGLE_CALENDAR_ID, {})
    return cal_busy.get("busy", [])