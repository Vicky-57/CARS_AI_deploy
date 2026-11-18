"""
app/api/v1/endpoints/meetings.py
────────────────────────────────────────────────────────────────────────
Unified Meeting Scheduling, Free Slots, and Clash Guard Endpoints
Shared between the Web Portal Calendar and WhatsApp Assistant.
────────────────────────────────────────────────────────────────────────
"""
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services import meeting_service as ms

router = APIRouter(prefix="/meetings", tags=["Meetings & Calendar Scheduling"])


class CreateMeetingRequest(BaseModel):
    client_name: str
    start_time: str = Field(..., description="UTC ISO datetime string")
    end_time: str = Field(..., description="UTC ISO datetime string")
    client_phone: str = ""
    customer_email: str = ""
    vehicle: str = ""
    deal_type: str = "UNKNOWN"
    lead_id: Optional[str] = None
    project_id: Optional[str] = None
    location_type: str = Field("OFFLINE_ONSITE", description="OFFLINE_ONSITE or ONLINE")
    location_address: str = ""
    title: Optional[str] = None
    notes: str = ""


class RescheduleMeetingRequest(BaseModel):
    start_time: str
    end_time: str


@router.get("/free-slots")
async def get_free_slots(
    day: str = Query(..., description="Date YYYY-MM-DD in Europe/Berlin"),
    duration: int = Query(60, ge=15, le=240),
    is_offline: bool = Query(True),
):
    try:
        parsed_day = date.fromisoformat(day)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format; expected YYYY-MM-DD")

    slots = ms.get_free_slots(parsed_day, duration_minutes=duration, is_offline=is_offline)
    return {
        "date": day,
        "timezone": "Europe/Berlin",
        "duration_minutes": duration,
        "is_offline": is_offline,
        "slots": slots,
    }


@router.get("")
async def list_meetings(limit: int = Query(20, ge=1, le=100), days_ahead: int = Query(14, ge=1, le=90)):
    return {"meetings": ms.list_upcoming_meetings(limit=limit, days_ahead=days_ahead)}


@router.post("")
async def create_meeting(req: CreateMeetingRequest):
    dt_s = ms._parse_iso_utc(req.start_time)
    dt_e = ms._parse_iso_utc(req.end_time)
    if not dt_s or not dt_e or dt_e <= dt_s:
        raise HTTPException(status_code=400, detail="Invalid start_time / end_time")

    res = ms.create_meeting(
        client_name=req.client_name,
        start_utc=dt_s,
        end_utc=dt_e,
        client_phone=req.client_phone,
        customer_email=req.customer_email,
        vehicle=req.vehicle,
        deal_type=req.deal_type,
        lead_id=req.lead_id,
        project_id=req.project_id,
        location_type=req.location_type,
        location_address=req.location_address,
        title=req.title,
        notes=req.notes,
    )
    if res.get("conflict"):
        raise HTTPException(status_code=409, detail={"message": "Time slot conflicts with an existing appointment.", "blocking": res["blocking_events"]})
    return res


@router.patch("/{meeting_id}/reschedule")
async def reschedule_meeting(meeting_id: str, req: RescheduleMeetingRequest):
    dt_s = ms._parse_iso_utc(req.start_time)
    dt_e = ms._parse_iso_utc(req.end_time)
    if not dt_s or not dt_e or dt_e <= dt_s:
        raise HTTPException(status_code=400, detail="Invalid start_time / end_time")
    res = ms.reschedule_meeting(meeting_id, dt_s, dt_e)
    if res.get("not_found"):
        raise HTTPException(status_code=404, detail="Meeting not found")
    if res.get("conflict"):
        raise HTTPException(status_code=409, detail={"message": "Time slot conflicts with an existing appointment.", "blocking": res["blocking_events"]})
    return res


@router.delete("/{meeting_id}")
async def cancel_meeting(meeting_id: str):
    res = ms.cancel_meeting(meeting_id)
    if not res:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"cancelled": True, "meeting": res}
