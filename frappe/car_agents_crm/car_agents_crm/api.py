"""
car_agents_crm/api.py
─────────────────────────────────────────────────────────────────────────────
Central whitelisted API endpoints for CAR-AGENTS Frappe CRM custom app.

Endpoints in this file:
  1. extract_client_details        — OCR → Contact auto-population (Phase 2)
  2. extract_vehicle_specs         — OCR → CRM Deal vehicle fields (Phase 4)
  3. generate_contract_pdf         — 1-click PDF contract generation (Phase 4/5)
  4. log_communication             — n8n W1/W2 communication logging (Phase 6)
  5. classify_lead_intent          — AI BUY/SELL intent classification (Phase 3)
  6. get_pipeline_summary          — Executive briefing data source (Phase 6)
  7. check_calendar_conflicts      — Meeting conflict guard (Phase 7)

All methods are decorated with @frappe.whitelist() and authenticated via
Frappe API Key + Secret header:  Authorization: token <api_key>:<api_secret>
─────────────────────────────────────────────────────────────────────────────
"""

import frappe
import requests
import json
from frappe.utils import now_datetime, add_days, today
from car_agents_crm.utils.pdf_generator import generate_pdf_from_template
from car_agents_crm.utils.whatsapp import send_whatsapp_message

# ─── Local FastAPI OCR Server URL ─────────────────────────────────────────────
LOCAL_SERVICES_URL = frappe.conf.get("local_services_url", "http://localhost:9000")


# ─────────────────────────────────────────────────────────────────────────────
# 1. EXTRACT CLIENT DETAILS FROM DOCUMENT (OCR)
# ─────────────────────────────────────────────────────────────────────────────
@frappe.whitelist()
def extract_client_details(file_url: str, contact_name: str = None):
    """
    Calls the local FastAPI OCR server to extract personal client details
    from an uploaded document (e.g. Personalausweis, follow-up PDF).

    Returns structured JSON that auto-populates a CRM Contact record.

    Args:
        file_url:     Frappe file URL of the uploaded document
        contact_name: Optional existing CRM Contact to update

    Returns:
        dict: { first_name, last_name, email, phone, address, id_number, ... }
    """
    frappe.only_for("System Manager", "CRM Manager", "CRM User")

    # Get physical path of the uploaded file
    file_doc = frappe.get_doc("File", {"file_url": file_url})
    file_path = file_doc.get_full_path()

    # Call local FastAPI OCR endpoint
    try:
        response = requests.post(
            f"{LOCAL_SERVICES_URL}/ocr/client-details",
            json={"file_path": file_path},
            timeout=60
        )
        response.raise_for_status()
        extracted = response.json()
    except requests.RequestException as e:
        frappe.throw(f"OCR Service Error: {str(e)}")

    # If a contact name is provided, auto-update the record
    if contact_name and extracted:
        _update_contact_from_ocr(contact_name, extracted)

    return extracted


def _update_contact_from_ocr(contact_name: str, data: dict):
    """Updates a Frappe CRM Contact with OCR-extracted client details."""
    contact = frappe.get_doc("CRM Contact", contact_name)
    field_map = {
        "first_name": "first_name",
        "last_name": "last_name",
        "email": "email_id",
        "phone": "mobile_no",
        "address": "address_line1",
        "city": "city",
        "postcode": "pincode",
        "id_number": "custom_id_number",
        "nationality": "custom_nationality",
    }
    for ocr_key, frappe_field in field_map.items():
        if data.get(ocr_key):
            contact.set(frappe_field, data[ocr_key])
    contact.save(ignore_permissions=True)
    frappe.db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# 2. EXTRACT VEHICLE SPECS FROM FAHRZEUGDATENTRÄGER (OCR)
# ─────────────────────────────────────────────────────────────────────────────
@frappe.whitelist()
def extract_vehicle_specs(file_url: str, deal_id: str = None):
    """
    Calls the local FastAPI OCR server to extract vehicle specifications
    from a German Fahrzeugdatenträger / Fahrzeugschein document image.

    Extracted fields include: VIN, Manufacturer, Model, Power (kW/PS),
    Displacement, Transmission Code, Colour Code, Registration Date,
    TÜV Expiry, Equipment/PR Codes.

    Args:
        file_url: Frappe file URL of the vehicle document image/PDF
        deal_id:  Optional CRM Deal ID to auto-populate vehicle fields

    Returns:
        dict: Structured vehicle spec data
    """
    frappe.only_for("System Manager", "CRM Manager", "CRM User")

    file_doc = frappe.get_doc("File", {"file_url": file_url})
    file_path = file_doc.get_full_path()

    try:
        response = requests.post(
            f"{LOCAL_SERVICES_URL}/ocr/vehicle-specs",
            json={"file_path": file_path},
            timeout=60
        )
        response.raise_for_status()
        extracted = response.json()
    except requests.RequestException as e:
        frappe.throw(f"OCR Service Error: {str(e)}")

    # Auto-populate deal if deal_id provided
    if deal_id and extracted:
        _update_deal_vehicle_specs(deal_id, extracted)

    return extracted


def _update_deal_vehicle_specs(deal_id: str, data: dict):
    """Updates a CRM Deal with OCR-extracted vehicle spec fields."""
    deal = frappe.get_doc("CRM Deal", deal_id)
    field_map = {
        "vin":                  "custom_vin",
        "manufacturer":         "custom_manufacturer",
        "model":                "custom_vehicle_model",
        "power_kw":             "custom_power_kw",
        "power_ps":             "custom_power_ps",
        "displacement_ccm":     "custom_displacement_ccm",
        "transmission_code":    "custom_transmission_code",
        "colour_code":          "custom_colour_code",
        "initial_registration": "custom_initial_registration",
        "tuv_expiry":           "custom_tuv_expiry_date",
        "licence_plate":        "custom_licence_plate",
    }
    for ocr_key, frappe_field in field_map.items():
        if data.get(ocr_key):
            deal.set(frappe_field, data[ocr_key])
    deal.custom_ocr_status = "Processed"
    deal.save(ignore_permissions=True)
    frappe.db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# 3. GENERATE CONTRACT PDF (1-CLICK)
# ─────────────────────────────────────────────────────────────────────────────
@frappe.whitelist()
def generate_contract_pdf(deal_id: str, template_type: str):
    """
    Generates a pre-filled PDF contract from a CRM Deal's data.

    Template Types:
      - "sell_b2c"      → Vermittlungsvertrag B2C Aktiv
      - "buy_passiv"    → Vermittlungsvertrag Beschaffung Passiv
      - "kaufvertrag"   → Kaufvertrag C2C Bilingual
      - "handover"      → Fahrzeug-Übergabeprotokoll

    Args:
        deal_id:       CRM Deal document name
        template_type: One of the four template type strings above

    Returns:
        dict: { file_url, file_name } of the generated PDF attachment
    """
    frappe.only_for("System Manager", "CRM Manager", "CRM User")

    VALID_TEMPLATES = ["sell_b2c", "buy_passiv", "kaufvertrag", "handover"]
    if template_type not in VALID_TEMPLATES:
        frappe.throw(f"Invalid template_type. Must be one of: {VALID_TEMPLATES}")

    deal = frappe.get_doc("CRM Deal", deal_id)
    result = generate_pdf_from_template(deal, template_type)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 4. LOG COMMUNICATION (called by n8n W1 Email & W2 WhatsApp workflows)
# ─────────────────────────────────────────────────────────────────────────────
@frappe.whitelist(allow_guest=False)
def log_communication(
    channel: str,           # "email" | "whatsapp"
    contact_identifier: str,  # email address or phone number
    direction: str,         # "inbound" | "outbound"
    content: str,
    subject: str = "",
    intent: str = "",       # "BUY_INTENT" | "SELL_INTENT" | "UNKNOWN"
    deal_id: str = None,
):
    """
    Called by n8n W1 (Email Logger) and W2 (WhatsApp Logger) to record
    incoming/outgoing communications against a CRM Contact & Deal.

    Args:
        channel:            Communication channel ("email" or "whatsapp")
        contact_identifier: Email address or phone number of the contact
        direction:          "inbound" or "outbound"
        content:            Full message body/text
        subject:            Email subject (optional)
        intent:             AI-classified intent ("BUY_INTENT" / "SELL_INTENT")
        deal_id:            Existing CRM Deal to link communication to (optional)

    Returns:
        dict: { communication_id, contact_id, deal_id }
    """
    # Find or create contact
    contact = _find_or_create_contact(channel, contact_identifier)

    # Create CRM Communication record
    comm = frappe.get_doc({
        "doctype": "CRM Communication",
        "reference_doctype": "CRM Deal" if deal_id else "CRM Contact",
        "reference_docname": deal_id or contact.name,
        "type": "Email" if channel == "email" else "WhatsApp",
        "subject": subject or f"{channel.title()} Message",
        "content": content,
        "sent_or_received": "Received" if direction == "inbound" else "Sent",
        "communication_date": now_datetime(),
    })
    comm.insert(ignore_permissions=True)

    # If intent is classified, update lead/deal
    if intent in ("BUY_INTENT", "SELL_INTENT"):
        _update_or_create_lead(contact, intent, content, deal_id)

    frappe.db.commit()
    return {
        "communication_id": comm.name,
        "contact_id": contact.name,
        "deal_id": deal_id,
    }


def _find_or_create_contact(channel: str, identifier: str):
    """Finds an existing CRM Contact or creates a new one."""
    filter_field = "email_id" if channel == "email" else "mobile_no"
    existing = frappe.db.get_value("CRM Contact", {filter_field: identifier}, "name")
    if existing:
        return frappe.get_doc("CRM Contact", existing)

    # Create new contact
    contact = frappe.get_doc({
        "doctype": "CRM Contact",
        filter_field: identifier,
        "first_name": identifier.split("@")[0] if "@" in identifier else identifier,
    })
    contact.insert(ignore_permissions=True)
    return contact


def _update_or_create_lead(contact, intent: str, content: str, deal_id: str = None):
    """Creates or updates a CRM Lead with the classified intent."""
    if deal_id:
        frappe.db.set_value("CRM Deal", deal_id, "custom_client_intent", intent)
        return

    lead = frappe.get_doc({
        "doctype": "CRM Lead",
        "first_name": contact.first_name,
        "email": contact.email_id,
        "mobile_no": contact.mobile_no,
        "custom_client_intent": intent,
        "custom_pipeline_type": "sell" if intent == "SELL_INTENT" else "buy",
        "lead_owner": frappe.session.user,
        "source": "WhatsApp" if contact.mobile_no else "Email",
    })
    lead.insert(ignore_permissions=True)


# ─────────────────────────────────────────────────────────────────────────────
# 5. CLASSIFY LEAD INTENT (AI call via local FastAPI)
# ─────────────────────────────────────────────────────────────────────────────
@frappe.whitelist()
def classify_lead_intent(message_text: str):
    """
    Sends message text to local FastAPI /classify-intent endpoint
    which uses Claude/Llama to classify the message as BUY or SELL intent.

    Args:
        message_text: Raw message body from email or WhatsApp

    Returns:
        dict: { intent: "BUY_INTENT" | "SELL_INTENT" | "UNKNOWN", confidence: float }
    """
    try:
        response = requests.post(
            f"{LOCAL_SERVICES_URL}/classify-intent",
            json={"message": message_text},
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        return {"intent": "UNKNOWN", "confidence": 0.0, "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# 6. PIPELINE SUMMARY (for n8n W5 Executive Briefing)
# ─────────────────────────────────────────────────────────────────────────────
@frappe.whitelist()
def get_pipeline_summary():
    """
    Returns a structured summary of the current CRM pipeline state.
    Called by n8n W5 to build the daily/weekly executive briefing.

    Returns:
        dict: Pipeline stats, inactive deals, new leads, document checklist counts
    """
    today_str = today()
    cutoff_24h = add_days(today_str, -1)

    # New leads in last 24 hours
    new_leads = frappe.db.count("CRM Lead", {"creation": [">", cutoff_24h]})

    # Active deals by pipeline type
    sell_deals = frappe.db.count("CRM Deal", {
        "custom_pipeline_type": "sell",
        "status": ["not in", ["Won", "Lost"]]
    })
    buy_deals = frappe.db.count("CRM Deal", {
        "custom_pipeline_type": "buy",
        "status": ["not in", ["Won", "Lost"]]
    })

    # Inactive deals (no activity in >24h and no future follow-up date set)
    inactive_deals = frappe.db.get_all(
        "CRM Deal",
        filters={
            "modified": ["<", cutoff_24h],
            "status": ["not in", ["Won", "Lost"]],
            "custom_followup_target_date": ["in", ["", None]],
        },
        fields=["name", "lead_name", "custom_pipeline_type", "modified"],
        limit=20
    )

    # Deals with pending document checklists (ocr_status = Pending)
    pending_ocr = frappe.db.count("CRM Deal", {"custom_ocr_status": "Pending"})

    return {
        "summary_date": today_str,
        "new_leads_24h": new_leads,
        "active_sell_deals": sell_deals,
        "active_buy_deals": buy_deals,
        "inactive_deals": inactive_deals,
        "pending_ocr_documents": pending_ocr,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 7. CHECK CALENDAR CONFLICTS (30-min travel buffer guard)
# ─────────────────────────────────────────────────────────────────────────────
@frappe.whitelist()
def check_calendar_conflicts(proposed_start: str, proposed_end: str, is_onsite: bool = True):
    """
    Checks if a proposed meeting time conflicts with existing CRM Events,
    applying a 30-minute travel buffer for onsite/offline meetings.

    Args:
        proposed_start: ISO datetime string e.g. "2026-08-05 10:00:00"
        proposed_end:   ISO datetime string e.g. "2026-08-05 11:00:00"
        is_onsite:      If True, applies 30-min travel buffer on each side

    Returns:
        dict: { has_conflict: bool, conflicting_events: list }
    """
    from datetime import datetime, timedelta

    start_dt = datetime.fromisoformat(proposed_start)
    end_dt = datetime.fromisoformat(proposed_end)

    if is_onsite:
        buffer = timedelta(minutes=30)
        check_start = start_dt - buffer
        check_end = end_dt + buffer
    else:
        check_start = start_dt
        check_end = end_dt

    conflicting = frappe.db.get_all(
        "Event",
        filters=[
            ["starts_on", "<", check_end.isoformat()],
            ["ends_on", ">", check_start.isoformat()],
            ["owner", "=", frappe.session.user],
        ],
        fields=["name", "subject", "starts_on", "ends_on", "event_type"]
    )

    return {
        "has_conflict": len(conflicting) > 0,
        "conflicting_events": conflicting,
        "checked_start": check_start.isoformat(),
        "checked_end": check_end.isoformat(),
        "buffer_applied_minutes": 30 if is_onsite else 0,
    }
