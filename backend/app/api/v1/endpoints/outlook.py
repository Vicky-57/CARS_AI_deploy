"""
app/api/v1/endpoints/outlook.py
────────────────────────────────────────────────────────────────────────
Strato IMAP/SMTP, Phase 1 Inquiry Triage, Draft Approval & B2B Deals API
────────────────────────────────────────────────────────────────────────
"""
from datetime import datetime, timezone
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.outlook_service import (
    approve_inquiry_and_send,
    check_calendar_conflict,
    get_outlook_events,
    get_todays_schedule,
    poll_outlook_inbound_emails,
)

router = APIRouter(prefix="/outlook", tags=["Outlook Calendar & Email"])


class ConflictCheckRequest(BaseModel):
    proposed_datetime: str
    duration_minutes: int = 60
    travel_buffer_minutes: int = 30


class InquiryApproveRequest(BaseModel):
    send_draft: bool = True
    draft_subject: Optional[str] = None
    draft_reply: Optional[str] = None
    category: Optional[str] = None


class InquiryUpdateRequest(BaseModel):
    category: Optional[str] = None
    decision: Optional[str] = None
    priority: Optional[str] = None
    draft_subject: Optional[str] = None
    draft_reply: Optional[str] = None
    draft_status: Optional[str] = None
    resolution: Optional[str] = None
    is_qualified: Optional[bool] = None
    extracted_params: Optional[Dict] = None
    missing_fields: Optional[list] = None


class B2BDealRequest(BaseModel):
    triage_id: Optional[str] = None
    company_name: str
    contact_name: Optional[str] = None
    contact_email: str
    contact_phone: Optional[str] = None
    b2b_type: str = "general_offer"
    subject: Optional[str] = None
    offer_summary: Optional[str] = None
    status: str = "NEW"
    deal_value: Optional[float] = None
    follow_up_date: Optional[str] = None
    notes: Optional[str] = None


class B2BDealUpdateRequest(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    b2b_type: Optional[str] = None
    subject: Optional[str] = None
    offer_summary: Optional[str] = None
    status: Optional[str] = None
    deal_value: Optional[float] = None
    follow_up_date: Optional[str] = None
    notes: Optional[str] = None


class AutoReplySettingRequest(BaseModel):
    enabled: bool


@router.get("/schedule")
async def get_outlook_schedule():
    try:
        events = await get_todays_schedule()
        return {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "total_events": len(events),
            "events": events,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events")
async def get_outlook_calendar_events(time_min: str = None, time_max: str = None):
    try:
        return await get_outlook_events(time_min=time_min, time_max=time_max)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-conflict")
async def check_conflict(req: ConflictCheckRequest):
    try:
        proposed_dt = datetime.fromisoformat(req.proposed_datetime)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid proposed_datetime format. Use ISO: YYYY-MM-DDTHH:MM:SS")
    return await check_calendar_conflict(
        proposed_dt=proposed_dt,
        duration_minutes=req.duration_minutes,
        travel_buffer_minutes=req.travel_buffer_minutes,
    )


@router.post("/poll-emails")
async def trigger_email_poll():
    try:
        new_leads = await poll_outlook_inbound_emails()
        return {
            "success": True,
            "new_leads_created": len(new_leads),
            "processed": len(new_leads),
            "leads": new_leads,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def outlook_integration_status():
    from config import settings
    ics_url = getattr(settings, "OUTLOOK_ICS_URL", None)
    imap_user = getattr(settings, "IMAP_USER", None)
    imap_pass = getattr(settings, "IMAP_PASSWORD", None)
    return {
        "ics_feed_configured": bool(ics_url),
        "imap_email_configured": bool(imap_user),
        "imap_password_configured": bool(imap_pass),
        "imap_user": imap_user or "Not set",
        "email_auto_reply": bool(getattr(settings, "EMAIL_AUTO_REPLY", False)),
        "guide": {
            "ics_feed": "In Outlook 365, go to Calendar → Share → Publish → Copy ICS link → set as OUTLOOK_ICS_URL in .env",
            "imap": "Set IMAP_HOST, IMAP_PORT, IMAP_USER, and IMAP_PASSWORD in .env",
        },
    }


@router.post("/auto-reply-setting")
async def toggle_email_auto_reply(req: AutoReplySettingRequest):
    from config import settings
    settings.EMAIL_AUTO_REPLY = bool(req.enabled)
    return {"email_auto_reply": settings.EMAIL_AUTO_REPLY}


@router.get("/triage-stats")
async def email_triage_stats(days: int = 30):
    from app.services import email_triage_store as tstore
    from config import settings
    return {
        "stats": tstore.stats(days),
        "pending_review": tstore.list_pending(30),
        "email_auto_reply": bool(getattr(settings, "EMAIL_AUTO_REPLY", False)),
    }


@router.get("/inquiries")
async def list_phase1_inquiries(limit: int = 200, days: Optional[int] = None):
    from app.services import email_triage_store as tstore
    from config import settings
    return {
        "inquiries": tstore.list_inquiries(limit=limit, days=days),
        "stats": tstore.stats(days or 30),
        "email_auto_reply": bool(getattr(settings, "EMAIL_AUTO_REPLY", False)),
    }


@router.post("/inquiries/{triage_id}/approve")
async def approve_phase1_inquiry(triage_id: str, req: InquiryApproveRequest):
    try:
        return await approve_inquiry_and_send(
            triage_id=triage_id,
            send_draft=req.send_draft,
            custom_draft_body=req.draft_reply,
            custom_draft_subject=req.draft_subject,
            new_category=req.category,
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/inquiries/{triage_id}")
async def update_phase1_inquiry(triage_id: str, req: InquiryUpdateRequest):
    from app.services import email_triage_store as tstore
    from app.services.email_triage_service import build_draft_reply, compute_missing_fields

    row = tstore.find_inquiry(triage_id) or tstore.get_inquiry(triage_id)
    if not row:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    # If owner changed category and didn't supply custom draft, regenerate draft & missing fields
    if "category" in fields and "draft_reply" not in fields:
        cat = fields["category"]
        params = fields.get("extracted_params") or row.get("extracted_params") or {}
        missing = compute_missing_fields(cat, params)
        d_subj, d_body = build_draft_reply(cat, row.get("sender_name") or "", row.get("subject") or "", params, missing)
        fields["missing_fields"] = missing
        fields["draft_subject"] = d_subj
        fields["draft_reply"] = d_body

    if fields.get("resolution") in ("ok", "no"):
        fields["resolved_at"] = datetime.now(timezone.utc).isoformat()

    updated = tstore.update_decision(row["id"], fields)
    return {"inquiry": updated or {**row, **fields}}


@router.get("/b2b-deals")
async def get_b2b_deals(limit: int = 100):
    from app.services import email_triage_store as tstore
    return {"deals": tstore.list_b2b_deals(limit=limit)}


@router.post("/b2b-deals")
async def create_b2b_deal_endpoint(req: B2BDealRequest):
    from app.services import email_triage_store as tstore
    deal = tstore.create_b2b_deal(req.model_dump())
    if req.triage_id:
        tstore.update_decision(req.triage_id, {
            "decision": "b2b",
            "resolution": "ok",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"deal": deal}


@router.patch("/b2b-deals/{deal_id}")
async def update_b2b_deal_endpoint(deal_id: str, req: B2BDealUpdateRequest):
    from app.services import email_triage_store as tstore
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    updated = tstore.update_b2b_deal(deal_id, fields)
    if not updated:
        raise HTTPException(status_code=404, detail="B2B deal not found")
    return {"deal": updated}


@router.delete("/b2b-deals/{deal_id}")
async def delete_b2b_deal_endpoint(deal_id: str):
    from app.services import email_triage_store as tstore
    tstore.delete_b2b_deal(deal_id)
    return {"deleted": True}


# ─── Phase 1 (§10) Reminders, Working Hours & Bavarian Holidays Endpoints ─

class WorkingHoursUpdateRequest(BaseModel):
    work_days: list = [0, 1, 2, 3, 4, 5]
    start_hour: int = 9
    end_hour: int = 18


class CreateReminderRequest(BaseModel):
    title: str
    due_at: Optional[str] = None
    hours_from_now: Optional[float] = 4.0
    reminder_type: str = "custom"
    triage_id: Optional[str] = None
    lead_id: Optional[str] = None
    project_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_contact: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None


@router.get("/working-hours")
async def get_crm_working_hours():
    from app.services import reminder_service as rs
    cfg = rs.get_working_hours()
    year = datetime.now().year
    holidays = {d.isoformat(): name for d, name in rs.bavarian_holidays(year).items()}
    return {"working_hours": cfg, "bavarian_holidays": holidays}


@router.put("/working-hours")
async def update_crm_working_hours(req: WorkingHoursUpdateRequest):
    from app.services import reminder_service as rs
    updated = rs.update_working_hours(req.work_days, req.start_hour, req.end_hour)
    return {"working_hours": updated}


@router.get("/reminders")
async def get_crm_reminders(status: str = "OPEN", limit: int = 100):
    from app.services import reminder_service as rs
    return {
        "reminders": rs.list_reminders(status=status, limit=limit),
        "working_hours": rs.get_working_hours(),
    }


@router.post("/reminders")
async def create_crm_reminder(req: CreateReminderRequest):
    from app.services import reminder_service as rs
    if req.due_at:
        due = datetime.fromisoformat(req.due_at.replace("Z", "+00:00"))
    else:
        due = rs.add_working_hours(datetime.now(timezone.utc), float(req.hours_from_now or 4.0))
    row = rs.create_reminder(
        title=req.title,
        due_at=due,
        reminder_type=req.reminder_type,
        triage_id=req.triage_id,
        lead_id=req.lead_id,
        project_id=req.project_id,
        customer_name=req.customer_name,
        customer_contact=req.customer_contact,
        category=req.category,
        notes=req.notes,
    )
    return {"reminder": row}


@router.post("/reminders/{reminder_id}/complete")
async def complete_crm_reminder(reminder_id: str):
    from app.services import reminder_service as rs
    updated = rs.mark_completed(reminder_id, via="CRM")
    if not updated:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"reminder": updated}


@router.post("/inquiries/{triage_id}/split-sell-source")
async def split_combined_sell_and_source(triage_id: str):
    """§6: Manually split or link a combined Sell + Source inquiry into two linked inquiries."""
    from app.services import email_triage_store as tstore
    row = tstore.find_inquiry(triage_id) or tstore.get_inquiry(triage_id)
    if not row:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    companion = tstore.create_linked_sell_and_source(row)
    return {"primary": tstore.get_inquiry(row["id"]) or row, "companion": companion}
