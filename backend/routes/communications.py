from fastapi import APIRouter, Query
from typing import Optional, List
from services import supabase_service as db

router = APIRouter(prefix="/api/communications", tags=["Communications"])


@router.get("", response_model=List[dict])
def list_communications(
    channel: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    return db.get_communications(channel=channel, limit=limit)


@router.get("/lead/{lead_id}", response_model=List[dict])
def get_thread(lead_id: str):
    """Full communication thread for a specific lead contact."""
    return db.get_communications(lead_id=lead_id, limit=200)


@router.get("/contacts", response_model=List[dict])
def get_contact_list():
    """Unique contacts with last message preview for the split-panel sidebar."""
    comms = db.get_communications(limit=500)
    seen = {}
    for c in comms:
        key = c.get("sender_contact") or c.get("lead_id") or c.get("id")
        if key and key not in seen:
            seen[key] = c
    return list(seen.values())
