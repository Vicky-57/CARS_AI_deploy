from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from models.project import ProjectCreate, SELL_MILESTONES, BUY_MILESTONES
from services import supabase_service as db
from database import get_supabase
from datetime import datetime

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.get("", response_model=List[dict])
def list_projects(project_type: Optional[str] = Query(None)):
    return db.get_all_projects(project_type=project_type)


@router.get("/{project_id}", response_model=dict)
def get_project(project_id: str):
    project = db.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    sb = get_supabase()
    milestones = sb.table("project_milestones").select("*").eq("project_id", project_id).order("step_number").execute()
    project["milestones"] = milestones.data or []
    return project


@router.post("", response_model=dict, status_code=201)
def create_project(payload: ProjectCreate):
    data = payload.model_dump()
    data["status"] = "LEAD"
    milestones = SELL_MILESTONES if payload.project_type == "SELL" else BUY_MILESTONES
    data["current_stage"] = milestones[0]
    project = db.create_project(data)

    # Create default milestones
    if project.get("id"):
        sb = get_supabase()
        milestone_rows = [
            {
                "project_id": project["id"],
                "step_number": i + 1,
                "title": title,
                "is_completed": False,
            }
            for i, title in enumerate(milestones)
        ]
        sb.table("project_milestones").insert(milestone_rows).execute()

    return project


@router.patch("/{project_id}", response_model=dict)
def update_project(project_id: str, updates: dict):
    return db.update_project(project_id, updates)


@router.patch("/{project_id}/milestone/{milestone_id}", response_model=dict)
def complete_milestone(project_id: str, milestone_id: str):
    sb = get_supabase()
    sb.table("project_milestones").update({"is_completed": True, "completed_at": datetime.utcnow().isoformat()}).eq("id", milestone_id).execute()
    # Update current stage to next incomplete milestone
    ms_res = sb.table("project_milestones").select("*").eq("project_id", project_id).order("step_number").execute()
    milestones = ms_res.data or []
    next_ms = next((m for m in milestones if not m.get("is_completed") and m["id"] != milestone_id), None)
    if next_ms:
        db.update_project(project_id, {"current_stage": next_ms["title"]})
    return {"success": True}
