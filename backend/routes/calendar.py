from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from services import supabase_service as db

router = APIRouter(prefix="/api/meetings", tags=["Calendar"])

TRAVEL_BUFFER_MINUTES = 30


class MeetingCreate(BaseModel):
    title: str
    lead_id: Optional[str] = None
    project_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    is_onsite: bool = False
    location: Optional[str] = None
    notes: Optional[str] = None
    attendee_name: Optional[str] = None
    attendee_contact: Optional[str] = None


class ConflictCheckRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    is_onsite: bool = False


@router.get("", response_model=list)
def list_meetings():
    return db.get_meetings()


@router.post("/check-conflict")
def check_conflict(req: ConflictCheckRequest):
    """Check if the proposed time slot conflicts with existing meetings.
    For onsite meetings, adds a 30-min travel buffer on both sides."""
    all_meetings = db.get_meetings(limit=200)
    buffer = timedelta(minutes=TRAVEL_BUFFER_MINUTES) if req.is_onsite else timedelta(0)
    padded_start = req.start_time - buffer
    padded_end = req.end_time + buffer

    conflicts = []
    for m in all_meetings:
        try:
            ms = datetime.fromisoformat(m["start_time"])
            me = datetime.fromisoformat(m["end_time"])
        except Exception:
            continue
        # Overlap check
        if padded_start < me and padded_end > ms:
            conflicts.append({
                "id": m.get("id"),
                "title": m.get("title"),
                "start_time": m.get("start_time"),
                "end_time": m.get("end_time"),
            })

    return {
        "has_conflict": len(conflicts) > 0,
        "conflicts": conflicts,
        "checked_window": {
            "start": padded_start.isoformat(),
            "end": padded_end.isoformat(),
            "travel_buffer_applied": req.is_onsite,
        },
    }


@router.post("", response_model=dict, status_code=201)
def create_meeting(payload: MeetingCreate):
    # Auto-check conflict before creating
    conflict_check = check_conflict(ConflictCheckRequest(
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_onsite=payload.is_onsite,
    ))
    if conflict_check["has_conflict"]:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Meeting time conflicts with existing appointments.",
                "conflicts": conflict_check["conflicts"],
            },
        )
    data = payload.model_dump()
    data["start_time"] = payload.start_time.isoformat()
    data["end_time"] = payload.end_time.isoformat()
    return db.create_meeting(data)


@router.delete("/{meeting_id}")
def cancel_meeting(meeting_id: str):
    from database import get_supabase
    sb = get_supabase()
    sb.table("meetings").delete().eq("id", meeting_id).execute()
    return {"success": True}
