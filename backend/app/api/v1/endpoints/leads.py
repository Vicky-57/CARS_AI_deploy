"""
app/api/v1/endpoints/leads.py
────────────────────────────────────────────────────────────────────────
CRM Lead Management Endpoints

  GET    /leads               → List all leads (with optional filters)
  POST   /leads               → Create a new lead manually
  GET    /leads/{lead_id}     → Get single lead with message history
  PATCH  /leads/{lead_id}     → Update lead status / package
  POST   /leads/{lead_id}/convert → Convert lead to project
────────────────────────────────────────────────────────────────────────
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import get_supabase
from app.services.supabase_service import get_all_leads
import logging

logger = logging.getLogger("leads")
router = APIRouter(prefix="/leads", tags=["CRM Leads"])

PACKAGE_PRICES = {
    "Essential": 347,
    "Advanced": 1247,
    "Concierge": 2497,
}


class LeadCreateRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    vehicle_interest: Optional[str] = None
    intent: Optional[str] = "BUY_INTENT"          # BUY_INTENT or SELL_INTENT
    pipeline_type: Optional[str] = "BUY"           # BUY or SELL
    package: Optional[str] = None                  # Essential, Advanced, Concierge
    source: Optional[str] = "manual"
    notes: Optional[str] = None


class LeadUpdateRequest(BaseModel):
    status: Optional[str] = None
    package: Optional[str] = None
    intent: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def list_leads(
    status: Optional[str] = None,
    pipeline_type: Optional[str] = None,
    source: Optional[str] = None,
):
    """List all leads, with optional filters: status, pipeline_type, source."""
    try:
        sb = get_supabase()
        query = sb.table("leads").select("*").order("created_at", desc=True)
        if status:
            query = query.eq("status", status)
        if pipeline_type:
            query = query.eq("pipeline_type", pipeline_type)
        if source:
            query = query.eq("source", source)
        result = query.execute()
        return {
            "total": len(result.data),
            "leads": result.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_lead(req: LeadCreateRequest):
    """Create a new lead manually from portal or Telegram."""
    try:
        sb = get_supabase()
        data = req.model_dump(exclude_none=True)
        if req.package and req.package in PACKAGE_PRICES:
            data["package_price_eur"] = PACKAGE_PRICES[req.package]
        result = sb.table("leads").insert(data).execute()
        return {"success": True, "lead": result.data[0] if result.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{lead_id}")
async def get_lead(lead_id: str):
    """Get a single lead by ID, including its message history timeline."""
    try:
        sb = get_supabase()
        lead_res = sb.table("leads").select("*").eq("id", lead_id).execute()
        if not lead_res.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        lead = lead_res.data[0]

        # Fetch communication messages linked to this lead
        msgs_res = sb.table("messages").select("*").eq("lead_id", lead_id).order("created_at").execute()
        lead["message_history"] = msgs_res.data or []
        return lead
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{lead_id}")
async def update_lead(lead_id: str, req: LeadUpdateRequest):
    """Update a lead's status, package, intent, or notes."""
    try:
        sb = get_supabase()
        updates = req.model_dump(exclude_none=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        if "package" in updates and updates["package"] in PACKAGE_PRICES:
            updates["package_price_eur"] = PACKAGE_PRICES[updates["package"]]
        result = sb.table("leads").update(updates).eq("id", lead_id).execute()
        return {"success": True, "lead": result.data[0] if result.data else {}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{lead_id}/convert")
async def convert_lead_to_project(lead_id: str):
    """
    Convert a qualified lead into an active project.
    Auto-creates a 3-tier Google Drive folder structure:
      Customer Folder / 1. OCR / 2. Legal Docs / 3. Signed Docs
    """
    try:
        sb = get_supabase()
        lead_res = sb.table("leads").select("*").eq("id", lead_id).execute()
        if not lead_res.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        lead = lead_res.data[0]

        # Create project
        project_data = {
            "client_name": lead.get("name"),
            "client_phone": lead.get("phone"),
            "client_email": lead.get("email"),
            "project_type": lead.get("pipeline_type", "SELL"),
            "target_vehicle": lead.get("vehicle_interest"),
            "package": lead.get("package"),
            "package_price_eur": lead.get("package_price_eur"),
            "status": "ACTIVE",
            "stage": "INTAKE",
            "source_lead_id": lead_id,
        }
        proj_res = sb.table("projects").insert(project_data).execute()
        project = proj_res.data[0] if proj_res.data else {}
        project_id = project.get("id", lead_id)

        # Create 3-tier Drive folder structure
        drive_result = {}
        try:
            from app.services.gdrive_service import create_customer_folder_structure
            drive_result = create_customer_folder_structure(
                customer_name=lead.get("name", "Unknown"),
                project_id=str(project_id)
            )
        except Exception as drive_err:
            logger.warning(f"Drive folder creation failed: {drive_err}")
            drive_result = {"error": str(drive_err)}

        # Mark lead as converted
        sb.table("leads").update({"status": "CONVERTED"}).eq("id", lead_id).execute()

        return {
            "success": True,
            "project": project,
            "drive_folders": drive_result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
