"""
app/services/google_calendar_service.py
────────────────────────────────────────────────────────────────────────
Google Calendar integration (primary calendar of the connected Google account).

  - list_busy_events(start, end)  → external events that block free slots
  - create_event(meeting)         → returns Google event id (or None)
  - update_event(id, start, end)  → move an event
  - delete_event(id)              → remove an event

Events created by this app carry extendedProperties.private.car_agents_id so
they are NOT re-read as external busy time (the `meetings` table already
covers them; this avoids duplicates and self-clashes when rescheduling).

All functions fail soft (return None / [] / False) and log a warning, so a
Google outage or missing Calendar scope never breaks WhatsApp replies.
Requires the Calendar scope: re-authorize via /api/v1/auth/google/url.
────────────────────────────────────────────────────────────────────────
"""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.services.google_service import _get_valid_access_token

logger = logging.getLogger("google_calendar_service")

CAL_API = "https://www.googleapis.com/calendar/v3/calendars/primary"
TZ_NAME = "Europe/Berlin"


def _request(method: str, path: str = "", body: Optional[dict] = None, params: Optional[dict] = None) -> Optional[dict]:
    token = _get_valid_access_token()
    if not token:
        logger.debug("Google not connected; skipping calendar call.")
        return None
    url = f"{CAL_API}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Authorization": f"Bearer {token}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as he:
        if he.code == 403:
            logger.warning("Google Calendar 403 — Calendar scope missing. Re-authorize at /api/v1/auth/google/url")
        elif he.code == 404 and method == "DELETE":
            return {}
        else:
            logger.warning(f"Google Calendar {method} {path} failed: HTTP {he.code}")
        return None
    except Exception as e:
        logger.warning(f"Google Calendar {method} {path} error: {e}")
        return None


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def list_busy_events(range_start: datetime, range_end: datetime) -> List[Dict]:
    """External (not created by this app) timed, opaque events overlapping the range."""
    res = _request("GET", "/events", params={
        "timeMin": _iso(range_start),
        "timeMax": _iso(range_end),
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": "100",
    })
    if not res:
        return []
    out: List[Dict] = []
    for ev in res.get("items", []):
        if ev.get("status") == "cancelled" or ev.get("transparency") == "transparent":
            continue
        if (ev.get("extendedProperties") or {}).get("private", {}).get("car_agents_id"):
            continue
        s = (ev.get("start") or {}).get("dateTime")
        e = (ev.get("end") or {}).get("dateTime")
        if not s or not e:  # all-day events do not block client hours
            continue
        out.append({
            "id": f"gcal_{ev.get('id', '')[:32]}",
            "title": ev.get("summary") or "Google Calendar Event",
            "start_time": datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat(),
            "end_time": datetime.fromisoformat(e.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat(),
            "location_type": "OFFLINE_ONSITE" if ev.get("location") else "ONLINE",
            "location_address": ev.get("location") or "",
            "source": "google",
        })
    return out


def create_event(meeting: Dict) -> Optional[str]:
    """Create an event for a booked meeting. Returns the Google event id."""
    from app.services.meeting_service import _parse_iso_utc

    start = _parse_iso_utc(meeting.get("start_time", ""))
    end = _parse_iso_utc(meeting.get("end_time", ""))
    if not start or not end:
        return None
    loc = meeting.get("location_address") or ("Online" if meeting.get("location_type") == "ONLINE" else "CAR-AGENTS Office")
    desc = (
        f"Client: {meeting.get('client_name')}\n"
        f"Phone: {meeting.get('client_phone') or '-'}\n"
        f"Vehicle: {meeting.get('vehicle') or '-'}\n"
        f"Type: {meeting.get('deal_type') or '-'}\n"
        f"Booked via CAR-AGENTS WhatsApp assistant"
    )
    body = {
        "summary": meeting.get("title") or f"Termin mit {meeting.get('client_name')}",
        "location": loc,
        "description": desc,
        "start": {"dateTime": _iso(start), "timeZone": TZ_NAME},
        "end": {"dateTime": _iso(end), "timeZone": TZ_NAME},
        "extendedProperties": {"private": {"car_agents_id": str(meeting.get("id") or "1")}},
        "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 60}]},
    }
    res = _request("POST", "/events", body=body)
    return (res or {}).get("id")


def update_event(event_id: str, start: datetime, end: datetime) -> bool:
    res = _request("PATCH", f"/events/{urllib.parse.quote(event_id)}", body={
        "start": {"dateTime": _iso(start), "timeZone": TZ_NAME},
        "end": {"dateTime": _iso(end), "timeZone": TZ_NAME},
    })
    return res is not None


def delete_event(event_id: str) -> bool:
    return _request("DELETE", f"/events/{urllib.parse.quote(event_id)}") is not None
