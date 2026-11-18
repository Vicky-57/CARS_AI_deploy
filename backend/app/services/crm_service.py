"""
app/services/crm_service.py
────────────────────────────────────────────────────────────────────────
Shared CRM lookup, customer disambiguation, lead-to-deal conversion,
and stage transition logic used by WhatsApp, Telegram, and API routes.
────────────────────────────────────────────────────────────────────────
"""
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("crm_service")

VALID_STAGES = [
    "Intake & Onboarding",
    "Sourcing & Inspection",
    "Negotiation & Contract",
    "Marketing & Listing",
    "Completed & Delivered",
]


def normalize_digits(raw: Optional[str]) -> str:
    return re.sub(r"\D", "", raw or "")


def _phone_key(raw: Optional[str]) -> Optional[str]:
    d = normalize_digits(raw)
    if len(d) < 6:
        return None
    # Last 8 digits unifies +491701234567 and 01701234567 reliably
    return d[-8:] if len(d) >= 8 else d


def classify_query(query: str) -> str:
    """Detect whether search text is an email, phone number, or customer name."""
    q = (query or "").strip()
    if "@" in q:
        return "email"
    digits = normalize_digits(q)
    letters = re.sub(r"[^A-Za-z]", "", q)
    if len(digits) >= 6 and not letters:
        return "phone"
    return "name"


def _sb():
    from database import get_supabase
    return get_supabase()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_vehicle(rec: Dict) -> str:
    tv = (rec.get("target_vehicle") or "").strip()
    if tv and tv.lower() not in ("n/a", "vehicle tbd", "tbd"):
        return tv
    mk = (rec.get("manufacturer") or "").strip()
    md = (rec.get("model") or "").strip()
    combo = f"{mk} {md}".strip()
    return combo or tv or "Vehicle TBD"


def _extract_deal_type(rec: Dict) -> str:
    raw = (rec.get("project_type") or rec.get("intent") or "").upper()
    if "BUY" in raw:
        return "BUY"
    if "SELL" in raw:
        return "SELL"
    return "UNKNOWN"


def _extract_address(rec: Dict) -> str:
    parts = [
        (rec.get("address") or "").strip(),
        " ".join(x for x in [(rec.get("postcode") or "").strip(), (rec.get("city") or "").strip()] if x),
    ]
    return ", ".join(p for p in parts if p)


def merge_records_to_customers(leads: List[Dict], projects: List[Dict]) -> List[Dict]:
    """
    Group lead & project rows representing the same human (matched by phone tail or email)
    into unified CustomerProfile dicts, while keeping distinct people with the same name
    separate so they can be disambiguated.
    """
    groups: Dict[str, Dict] = {}

    def _bucket_key(phone: Optional[str], email: Optional[str], fallback: str) -> str:
        pk = _phone_key(phone)
        if pk:
            return f"phone:{pk}"
        em = (email or "").strip().lower()
        if em:
            return f"email:{em}"
        return fallback

    def _ensure(key: str) -> Dict:
        if key not in groups:
            groups[key] = {
                "key": key,
                "name": "Unknown",
                "phone": "",
                "email": "",
                "vehicle": "Vehicle TBD",
                "deal_type": "UNKNOWN",
                "stage_or_label": "",
                "lead_id": None,
                "project_id": None,
                "leads": [],
                "projects": [],
                "address": "",
                "last_contact": "",
            }
        return groups[key]

    # Process projects first so active deal metadata takes priority
    for p in projects:
        k = _bucket_key(p.get("client_phone"), p.get("client_email"), f"proj:{p.get('id') or uuid.uuid4()}")
        g = _ensure(k)
        g["projects"].append(p)
        if p.get("client_name") and g["name"] == "Unknown":
            g["name"] = p["client_name"]
        if p.get("client_phone") and not g["phone"]:
            g["phone"] = p["client_phone"]
        if p.get("client_email") and not g["email"]:
            g["email"] = p["client_email"]
        veh = _extract_vehicle(p)
        if veh != "Vehicle TBD":
            g["vehicle"] = veh
        dt = _extract_deal_type(p)
        if dt != "UNKNOWN" and g["deal_type"] == "UNKNOWN":
            g["deal_type"] = dt
        if not g["project_id"] or p.get("status") == "ACTIVE":
            g["project_id"] = p.get("id")
        if p.get("current_stage") and not g["stage_or_label"]:
            g["stage_or_label"] = f"Deal: {p['current_stage']}"
        ts = p.get("updated_at") or p.get("created_at") or ""
        if ts > g["last_contact"]:
            g["last_contact"] = ts

    for l in leads:
        k = _bucket_key(l.get("phone"), l.get("email"), f"lead:{l.get('id') or uuid.uuid4()}")
        g = _ensure(k)
        g["leads"].append(l)
        if l.get("name") and g["name"] == "Unknown":
            g["name"] = l["name"]
        if l.get("phone") and not g["phone"]:
            g["phone"] = l["phone"]
        if l.get("email") and not g["email"]:
            g["email"] = l["email"]
        if g["vehicle"] == "Vehicle TBD":
            veh = _extract_vehicle(l)
            if veh != "Vehicle TBD":
                g["vehicle"] = veh
        if g["deal_type"] == "UNKNOWN":
            dt = _extract_deal_type(l)
            if dt != "UNKNOWN":
                g["deal_type"] = dt
        if not g["lead_id"]:
            g["lead_id"] = l.get("id")
        if not g["address"]:
            addr = _extract_address(l)
            if addr:
                g["address"] = addr
        if not g["stage_or_label"]:
            lbl = l.get("lead_label") or l.get("label") or ""
            st = l.get("status") or "NEW"
            g["stage_or_label"] = f"Lead: {lbl} ({st})".strip() if lbl else f"Lead ({st})"
        ts = l.get("updated_at") or l.get("created_at") or ""
        if ts > g["last_contact"]:
            g["last_contact"] = ts

    result = list(groups.values())
    result.sort(key=lambda c: c.get("last_contact") or "", reverse=True)
    return result


def search_customers(
    query: str,
    limit: int = 10,
    mem_leads: Optional[Dict[str, Dict]] = None,
    mem_projects: Optional[List[Dict]] = None,
) -> List[Dict]:
    """
    Search leads & projects by name, normalized phone number, or email,
    returning merged distinct CustomerProfile dicts for disambiguation.
    """
    q = (query or "").strip()
    if not q:
        return []

    kind = classify_query(q)
    q_low = q.lower()
    digits = normalize_digits(q)
    tail = digits[-8:] if len(digits) >= 8 else digits

    if mem_leads is not None and mem_projects is not None:
        all_leads = list(mem_leads.values())
        all_projects = list(mem_projects)
        if kind == "email":
            leads = [l for l in all_leads if q_low in (l.get("email") or "").lower()]
            projects = [p for p in all_projects if q_low in (p.get("client_email") or "").lower()]
        elif kind == "phone":
            leads = [l for l in all_leads if tail and tail in normalize_digits(l.get("phone"))]
            projects = [p for p in all_projects if tail and tail in normalize_digits(p.get("client_phone"))]
        else:
            leads = [l for l in all_leads if q_low in (l.get("name") or "").lower()]
            projects = [p for p in all_projects if q_low in (p.get("client_name") or "").lower()]
        return merge_records_to_customers(leads, projects)[:limit]

    sb = _sb()
    leads: List[Dict] = []
    projects: List[Dict] = []

    if kind == "email":
        try:
            leads = sb.table("leads").select("*").ilike("email", f"*{q}*").limit(20).execute().data or []
        except Exception as e:
            logger.warning(f"Lead email search failed: {e}")
        try:
            projects = sb.table("projects").select("*").ilike("client_email", f"*{q}*").limit(20).execute().data or []
        except Exception as e:
            logger.warning(f"Project email search failed: {e}")
    elif kind == "phone":
        # Query by shorter numeric tail (last 6 chars) so formatting (+, spaces, leading 0) still hits DB,
        # then verify exact tail match in Python.
        db_tail = digits[-6:]
        try:
            raw_l = sb.table("leads").select("*").ilike("phone", f"*{db_tail}*").limit(25).execute().data or []
            leads = [l for l in raw_l if tail in normalize_digits(l.get("phone")) or normalize_digits(l.get("phone")).endswith(tail)]
        except Exception as e:
            logger.warning(f"Lead phone search failed: {e}")
        try:
            raw_p = sb.table("projects").select("*").ilike("client_phone", f"*{db_tail}*").limit(25).execute().data or []
            projects = [p for p in raw_p if tail in normalize_digits(p.get("client_phone")) or normalize_digits(p.get("client_phone")).endswith(tail)]
        except Exception as e:
            logger.warning(f"Project phone search failed: {e}")
    else:
        try:
            leads = sb.table("leads").select("*").ilike("name", f"*{q}*").limit(25).execute().data or []
        except Exception as e:
            logger.warning(f"Lead name search failed: {e}")
        try:
            projects = sb.table("projects").select("*").ilike("client_name", f"*{q}*").limit(25).execute().data or []
        except Exception as e:
            logger.warning(f"Project name search failed: {e}")

    return merge_records_to_customers(leads, projects)[:limit]


def recent_customers(
    limit: int = 8,
    mem_leads: Optional[Dict[str, Dict]] = None,
    mem_projects: Optional[List[Dict]] = None,
) -> List[Dict]:
    """Return recent merged customers that have a phone number or email for quick selection."""
    if mem_leads is not None and mem_projects is not None:
        return merge_records_to_customers(list(mem_leads.values()), list(mem_projects))[:limit]

    sb = _sb()
    leads: List[Dict] = []
    projects: List[Dict] = []
    try:
        leads = sb.table("leads").select("*").order("created_at", desc=True).limit(20).execute().data or []
    except Exception as e:
        logger.warning(f"Recent leads failed: {e}")
    try:
        projects = sb.table("projects").select("*").eq("status", "ACTIVE").order("created_at", desc=True).limit(20).execute().data or []
    except Exception as e:
        logger.warning(f"Recent projects failed: {e}")
    return merge_records_to_customers(leads, projects)[:limit]


def format_customer_card(cust: Dict) -> str:
    """Detailed single-customer profile card for WhatsApp."""
    lines = [f"👤 *{cust.get('name') or 'Unknown'}*"]
    if cust.get("phone"):
        lines.append(f"📞 {cust['phone']}")
    if cust.get("email"):
        lines.append(f"✉️ {cust['email']}")
    lines.append(f"🚗 {cust.get('vehicle') or 'Vehicle TBD'} ({cust.get('deal_type') or 'UNKNOWN'})")
    if cust.get("stage_or_label"):
        lines.append(f"📌 {cust['stage_or_label']}")
    if cust.get("address"):
        lines.append(f"📍 {cust['address']}")
    if len(cust.get("projects") or []) > 1:
        lines.append(f"💼 Active/Past Deals: {len(cust['projects'])}")
    if cust.get("last_contact"):
        lines.append(f"🕒 Updated: {str(cust['last_contact'])[:10]}")
    return "\n".join(lines)


def disambiguate_row_title(cust: Dict) -> str:
    """Short <= 24 char row title for list-picker / numbered disambiguation."""
    name = (cust.get("name") or "Unknown").strip()
    digits = normalize_digits(cust.get("phone"))
    suffix = f" (…{digits[-4:]})" if len(digits) >= 4 else ""
    max_name = max(6, 24 - len(suffix))
    return f"{name[:max_name]}{suffix}"


def disambiguate_row_desc(cust: Dict) -> str:
    veh = cust.get("vehicle") or "Vehicle TBD"
    dt = cust.get("deal_type") or "?"
    em = cust.get("email")
    extra = f" | {em}" if (not cust.get("phone") and em) else ""
    return f"{dt} • {veh}{extra}"[:72]


def to_session_ref(cust: Dict) -> Dict:
    """Slim serializable customer dict safe to store inside whatsapp_sessions JSONB."""
    return {
        "key": cust.get("key"),
        "name": cust.get("name") or "Unknown",
        "phone": cust.get("phone") or "",
        "email": cust.get("email") or "",
        "vehicle": cust.get("vehicle") or "Vehicle TBD",
        "deal_type": cust.get("deal_type") or "UNKNOWN",
        "stage_or_label": cust.get("stage_or_label") or "",
        "lead_id": cust.get("lead_id"),
        "project_id": cust.get("project_id"),
        "address": cust.get("address") or "",
        "last_contact": cust.get("last_contact") or "",
    }


def convert_lead_to_project(
    lead_query: str,
    mem_leads: Optional[Dict[str, Dict]] = None,
    mem_projects: Optional[List[Dict]] = None,
) -> Optional[Dict]:
    """Convert an existing lead into an active CRM project/deal."""
    if mem_leads is not None and mem_projects is not None:
        matches = search_customers(lead_query, limit=1, mem_leads=mem_leads, mem_projects=mem_projects)
        if not matches or not matches[0].get("leads"):
            return None
        l = matches[0]["leads"][0]
        proj = {
            "id": str(uuid.uuid4()),
            "client_name": l.get("name"),
            "client_phone": l.get("phone"),
            "client_email": l.get("email"),
            "project_type": "SELL" if "sell" in (l.get("intent") or "").lower() else "BUY",
            "target_vehicle": _extract_vehicle(l),
            "status": "ACTIVE",
            "current_stage": "Intake & Onboarding",
            "created_at": _now(),
        }
        mem_projects.append(proj)
        return proj

    matches = search_customers(lead_query, limit=1)
    if not matches or not matches[0].get("leads"):
        return None
    lead = matches[0]["leads"][0]
    p_type = "SELL" if "sell" in (lead.get("intent") or "").lower() else "BUY"
    project_data = {
        "client_name": lead.get("name") or "New Customer",
        "client_phone": lead.get("phone"),
        "client_email": lead.get("email"),
        "project_type": p_type,
        "target_vehicle": _extract_vehicle(lead),
        "status": "ACTIVE",
        "current_stage": "Intake & Onboarding",
        "notes": lead.get("notes") or f"Converted from WhatsApp lead {lead.get('id')}",
    }
    proj_res = _sb().table("projects").insert(project_data).execute()
    return proj_res.data[0] if proj_res.data else project_data


def update_project_stage(
    client_query: str,
    target_stage_str: str,
    mem_projects: Optional[List[Dict]] = None,
) -> Optional[Tuple[Dict, str]]:
    """Update active deal stage."""
    t_low = (target_stage_str or "").lower()
    matched_stage = next((s for s in VALID_STAGES if t_low and t_low in s.lower()), None)
    if not matched_stage:
        return None

    if mem_projects is not None:
        for p in mem_projects:
            if client_query.lower() in (p.get("client_name") or "").lower():
                p["current_stage"] = matched_stage
                return p, matched_stage
        return None

    sb = _sb()
    proj_res = sb.table("projects").select("*").ilike("client_name", f"*{client_query}*").eq("status", "ACTIVE").limit(1).execute()
    if not proj_res.data:
        return None
    proj = proj_res.data[0]
    sb.table("projects").update({"current_stage": matched_stage}).eq("id", proj["id"]).execute()
    proj["current_stage"] = matched_stage
    return proj, matched_stage
