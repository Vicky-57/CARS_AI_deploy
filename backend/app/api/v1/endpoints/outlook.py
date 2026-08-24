"""
app/api/v1/endpoints/outlook.py
────────────────────────────────────────────────────────────────────────
Microsoft Outlook 365 Calendar & Email Integration Endpoints

  GET  /outlook/schedule          → Today's calendar events from Outlook ICS
  POST /outlook/check-conflict    → Check if proposed time has a conflict
  POST /outlook/poll-emails       → Manually trigger inbound email lead poll
  GET  /outlook/status            → ICS feed & IMAP connection status
────────────────────────────────────────────────────────────────────────
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from app.services.outlook_service import (
    get_todays_schedule,
    get_outlook_events,
    check_calendar_conflict,
    poll_outlook_inbound_emails
)

router = APIRouter(prefix="/outlook", tags=["Outlook Calendar & Email"])


class ConflictCheckRequest(BaseModel):
    proposed_datetime: str  # ISO format: "2026-08-22T14:00:00"
    duration_minutes: int = 60
    travel_buffer_minutes: int = 30


@router.get("/schedule")
async def get_outlook_schedule():
    """
    Fetch today's events from Maxim's Microsoft Outlook ICS calendar feed.
    Configure OUTLOOK_ICS_URL in .env with Maxim's private Outlook calendar link.
    """
    try:
        events = await get_todays_schedule()
        return {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "total_events": len(events),
            "events": events
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events")
async def get_outlook_calendar_events(time_min: str = None, time_max: str = None):
    """
    Fetch and parse Microsoft Outlook ICS calendar events formatted for Portal Calendar view.
    """
    try:
        res = await get_outlook_events(time_min=time_min, time_max=time_max)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-conflict")
async def check_conflict(req: ConflictCheckRequest):
    """
    Check whether a proposed meeting time conflicts with existing Outlook calendar
    events, including a configurable travel buffer (default: 30 minutes).
    """
    try:
        proposed_dt = datetime.fromisoformat(req.proposed_datetime)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid proposed_datetime format. Use ISO: YYYY-MM-DDTHH:MM:SS")

    result = await check_calendar_conflict(
        proposed_dt=proposed_dt,
        duration_minutes=req.duration_minutes,
        travel_buffer_minutes=req.travel_buffer_minutes
    )
    return result


@router.post("/poll-emails")
async def trigger_email_poll():
    """
    Manually trigger the Outlook / Strato IMAP inbox poll.
    Creates leads in Supabase for any new unread emails.
    """
    try:
        new_leads = await poll_outlook_inbound_emails()
        return {
            "success": True,
            "new_leads_created": len(new_leads),
            "leads": new_leads
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def outlook_integration_status():
    """Check whether Outlook ICS and IMAP credentials are configured."""
    from config import settings
    ics_url = getattr(settings, "OUTLOOK_ICS_URL", None)
    imap_user = getattr(settings, "IMAP_USER", None)
    imap_pass = getattr(settings, "IMAP_PASSWORD", None)

    return {
        "ics_feed_configured": bool(ics_url),
        "imap_email_configured": bool(imap_user),
        "imap_password_configured": bool(imap_pass),
        "imap_user": imap_user or "Not set",
        "guide": {
            "ics_feed": "In Outlook 365, go to Calendar → Share → Publish → Copy ICS link → set as OUTLOOK_ICS_URL in .env",
            "imap": "Set IMAP_HOST, IMAP_PORT, IMAP_USER, and IMAP_PASSWORD in .env"
        }
    }
