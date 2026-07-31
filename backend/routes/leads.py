from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from models.lead import LeadCreate, LeadOut
from services import supabase_service as db

router = APIRouter(prefix="/api/leads", tags=["Leads"])


@router.get("", response_model=List[dict])
def list_leads(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    intent: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    leads = db.get_all_leads(limit=limit, offset=offset)
    if intent:
        leads = [l for l in leads if l.get("intent") == intent.upper()]
    if channel:
        leads = [l for l in leads if l.get("channel") == channel.upper()]
    if status:
        leads = [l for l in leads if l.get("status") == status.upper()]
    return leads


@router.get("/{lead_id}", response_model=dict)
def get_lead(lead_id: str):
    lead = db.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    # Also fetch communications for this lead
    comms = db.get_communications(lead_id=lead_id)
    lead["communications"] = comms
    return lead


@router.post("", response_model=dict, status_code=201)
def create_lead(payload: LeadCreate):
    return db.create_lead(payload.model_dump())


@router.patch("/{lead_id}", response_model=dict)
def update_lead(lead_id: str, updates: dict):
    return db.update_lead(lead_id, updates)
