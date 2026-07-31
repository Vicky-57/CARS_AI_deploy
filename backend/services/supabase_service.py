from database import get_supabase
from typing import Optional, List, Dict, Any
from datetime import datetime


# ─── LEADS ────────────────────────────────────────────────────────────────────

def get_all_leads(limit: int = 100, offset: int = 0) -> List[Dict]:
    sb = get_supabase()
    res = sb.table("leads").select("*").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return res.data or []


def get_lead_by_id(lead_id: str) -> Optional[Dict]:
    sb = get_supabase()
    res = sb.table("leads").select("*").eq("id", lead_id).single().execute()
    return res.data


def create_lead(payload: Dict) -> Dict:
    sb = get_supabase()
    payload["created_at"] = datetime.utcnow().isoformat()
    payload["updated_at"] = datetime.utcnow().isoformat()
    res = sb.table("leads").insert(payload).execute()
    return res.data[0] if res.data else {}


def update_lead(lead_id: str, updates: Dict) -> Dict:
    sb = get_supabase()
    updates["updated_at"] = datetime.utcnow().isoformat()
    res = sb.table("leads").update(updates).eq("id", lead_id).execute()
    return res.data[0] if res.data else {}


# ─── PROJECTS ─────────────────────────────────────────────────────────────────

def get_all_projects(project_type: Optional[str] = None) -> List[Dict]:
    sb = get_supabase()
    q = sb.table("projects").select("*").order("created_at", desc=True)
    if project_type:
        q = q.eq("project_type", project_type)
    return q.execute().data or []


def get_project_by_id(project_id: str) -> Optional[Dict]:
    sb = get_supabase()
    res = sb.table("projects").select("*").eq("id", project_id).single().execute()
    return res.data


def create_project(payload: Dict) -> Dict:
    sb = get_supabase()
    payload["created_at"] = datetime.utcnow().isoformat()
    res = sb.table("projects").insert(payload).execute()
    return res.data[0] if res.data else {}


def update_project(project_id: str, updates: Dict) -> Dict:
    sb = get_supabase()
    res = sb.table("projects").update(updates).eq("id", project_id).execute()
    return res.data[0] if res.data else {}


# ─── COMMUNICATIONS ────────────────────────────────────────────────────────────

def get_communications(channel: Optional[str] = None, lead_id: Optional[str] = None, limit: int = 100) -> List[Dict]:
    sb = get_supabase()
    q = sb.table("communications").select("*").order("timestamp", desc=True).limit(limit)
    if channel:
        q = q.eq("channel", channel)
    if lead_id:
        q = q.eq("lead_id", lead_id)
    return q.execute().data or []


def save_communication(payload: Dict) -> Dict:
    sb = get_supabase()
    res = sb.table("communications").insert(payload).execute()
    return res.data[0] if res.data else {}


# ─── MEETINGS ─────────────────────────────────────────────────────────────────

def get_meetings(limit: int = 50) -> List[Dict]:
    sb = get_supabase()
    res = sb.table("meetings").select("*").order("start_time", desc=False).limit(limit).execute()
    return res.data or []


def create_meeting(payload: Dict) -> Dict:
    sb = get_supabase()
    res = sb.table("meetings").insert(payload).execute()
    return res.data[0] if res.data else {}
