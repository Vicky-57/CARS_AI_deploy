"""
app/api/v1/endpoints/meetings_sync.py
────────────────────────────────────────────────────────────────────────
Meeting ↔ Google Calendar sync engine endpoints:
  GET    /meetings/google-events       → fetch Google Calendar events for a date range
  POST   /meetings/{id}/sync           → create or update the Google event (dedup)
  DELETE /meetings/{id}/sync           → delete the Google event
  POST   /meetings/free-busy           → check Google calendar for clashes
────────────────────────────────────────────────────────────────────────
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import json, urllib.request, urllib.parse
from datetime import datetime, timedelta

from app.services.google_service import (
    create_event, update_event, delete_event, check_free_busy, is_connected,
    _get_valid_access_token
)
from app.services.supabase_service import get_meeting_by_id, update_meeting

router = APIRouter(prefix="/meetings", tags=["Meeting Calendar Sync"])


CALENDAR_API = "https://www.googleapis.com/calendar/v3"


@router.get("/google-events")
async def get_google_calendar_events(
    time_min: str = Query(None, description="ISO8601 start, e.g. 2026-08-01T00:00:00Z"),
    time_max: str = Query(None, description="ISO8601 end, e.g. 2026-08-31T23:59:59Z"),
    max_results: int = Query(50),
):
    """Fetch events directly from Google Calendar for the given date range."""
    if not is_connected():
        return {"connected": False, "events": []}

    token = _get_valid_access_token()
    if not token:
        return {"connected": False, "events": []}

    # Default: current month
    if not time_min:
        now = datetime.utcnow()
        time_min = now.replace(day=1, hour=0, minute=0, second=0).isoformat() + "Z"
    if not time_max:
        now = datetime.utcnow()
        # last day of month approximation
        time_max = (now.replace(day=1, hour=0, minute=0, second=0) + timedelta(days=45)).isoformat() + "Z"

    params = urllib.parse.urlencode({
        "timeMin": time_min,
        "timeMax": time_max,
        "maxResults": max_results,
        "singleEvents": "true",
        "orderBy": "startTime",
    })
    url = f"{CALENDAR_API}/calendars/primary/events?{params}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google Calendar fetch failed: {str(e)}")

    events = []
    for item in data.get("items", []):
        start = item.get("start", {})
        end = item.get("end", {})
        events.append({
            "id": "google_" + item.get("id", ""),
            "google_event_id": item.get("id"),
            "title": item.get("summary", "(No title)"),
            "client_name": "",
            "start_time": start.get("dateTime") or (start.get("date", "") + "T00:00:00"),
            "end_time": end.get("dateTime") or (end.get("date", "") + "T23:59:59"),
            "location_address": item.get("location", ""),
            "notes": item.get("description", ""),
            "location_type": "GOOGLE_CALENDAR",
            "source": "google",
        })

    return {"connected": True, "events": events, "count": len(events)}




class FreeBusyRequest(BaseModel):
    start_time: str
    end_time: str


class FreeBusySlot(BaseModel):
    start: str
    end: str


@router.post("/free-busy")
async def meetings_free_busy(req: FreeBusyRequest):
    """Check Maxim's Google calendar for busy slots in a given window."""
    if not is_connected():
        return {"connected": False, "busy": []}
    busy = check_free_busy(req.start_time, req.end_time)
    return {"connected": True, "busy": busy}


@router.post("/{meeting_id}/sync")
async def sync_meeting(meeting_id: str):
    """
    Create (or update) the Google Calendar event for a meeting.
    Dedups via the meeting's google_event_id — never creates twice.
    """
    if not is_connected():
        raise HTTPException(status_code=400, detail="Google Calendar is not connected.")

    meeting = get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    existing = meeting.get("google_event_id")
    try:
        if existing:
            update_event(existing, meeting)
        else:
            event_id = create_event(meeting)
            update_meeting(meeting_id, {"google_event_id": event_id})
    except PermissionError:
        raise HTTPException(status_code=400, detail="Google Calendar is not connected.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

    return {"success": True, "google_event_id": existing or meeting.get("google_event_id")}


@router.delete("/{meeting_id}/sync")
async def unsync_meeting(meeting_id: str):
    """Delete the Google Calendar event for a meeting and clear the stored id."""
    if not is_connected():
        raise HTTPException(status_code=400, detail="Google Calendar is not connected.")

    meeting = get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    event_id = meeting.get("google_event_id")
    if event_id:
        try:
            delete_event(event_id)
        except Exception:
            pass  # already gone on Google's side is fine
        update_meeting(meeting_id, {"google_event_id": None})

    return {"success": True}