"""
app/api/v1/endpoints/meetings_sync.py
────────────────────────────────────────────────────────────────────────
Meeting ↔ Google Calendar sync engine endpoints:
  POST   /meetings/{id}/sync         → create or update the Google event (dedup)
  DELETE /meetings/{id}/sync         → delete the Google event
  POST   /meetings/free-busy         → check Maxim's Google calendar for clashes
────────────────────────────────────────────────────────────────────────
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.services.google_service import (
    create_event, update_event, delete_event, check_free_busy, is_connected,
)
from app.services.supabase_service import get_meeting_by_id, update_meeting

router = APIRouter(prefix="/meetings", tags=["Meeting Calendar Sync"])


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