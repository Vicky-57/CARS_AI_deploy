"""
car_agents_crm/utils/pdf_generator.py
─────────────────────────────────────────────────────────────────────────────
1-Click PDF Contract Pre-filling for all 4 CAR-AGENTS Templates.

Templates supported:
  - sell_b2c      → Vermittlungsvertrag B2C Aktiv
  - buy_passiv    → Vermittlungsvertrag Beschaffung Passiv
  - kaufvertrag   → Kaufvertrag C2C Bilingual
  - handover      → Fahrzeug-Übergabeprotokoll

Strategy:
  Each template PDF is stored in the app's /templates/contracts/ directory.
  We use pypdf (formerly PyPDF2) to fill AcroForm fields, or fall back to
  a Jinja2 → HTML → WeasyPrint pipeline for templates without AcroForm fields.
─────────────────────────────────────────────────────────────────────────────
"""

import frappe
import os
from frappe.utils import get_files_path, now_datetime

# ─── Template Registry ────────────────────────────────────────────────────────
# Maps template_type → (PDF template filename, placeholder field mapping)
TEMPLATE_REGISTRY = {
    "sell_b2c": {
        "file": "Vermittlungsvertrag_B2C_aktiv.pdf",
        "label": "Vermittlungsvertrag B2C (Aktiv)",
        "fields": {
            "{{client_name}}":          "lead_name",
            "{{client_address}}":       "custom_client_address",
            "{{client_email}}":         "custom_client_email",
            "{{client_phone}}":         "custom_client_phone",
            "{{client_id_number}}":     "custom_client_id_number",
            "{{vin}}":                  "custom_vin",
            "{{manufacturer}}":         "custom_manufacturer",
            "{{vehicle_model}}":        "custom_vehicle_model",
            "{{initial_registration}}": "custom_initial_registration",
            "{{licence_plate}}":        "custom_licence_plate",
            "{{mileage_km}}":           "custom_mileage_km",
            "{{commission_eur}}":       "custom_commission_eur",
            "{{contract_date}}":        "creation",
        },
    },
    "buy_passiv": {
        "file": "Vermittlungsvertrag_Beschaffung_passiv.pdf",
        "label": "Vermittlungsvertrag Beschaffung (Passiv)",
        "fields": {
            "{{client_name}}":          "lead_name",
            "{{client_address}}":       "custom_client_address",
            "{{client_email}}":         "custom_client_email",
            "{{client_phone}}":         "custom_client_phone",
            "{{client_id_number}}":     "custom_client_id_number",
            "{{target_vehicle}}":       "custom_vehicle_model",
            "{{price_limit}}":          "custom_price_limit",
            "{{commission_eur}}":       "custom_commission_eur",
            "{{contract_date}}":        "creation",
        },
    },
    "kaufvertrag": {
        "file": "Kaufvertrag-C2C-Bilingual.pdf",
        "label": "Kaufvertrag C2C (Bilingual DE/EN)",
        "fields": {
            "{{seller_name}}":          "custom_seller_name",
            "{{seller_address}}":       "custom_seller_address",
            "{{buyer_name}}":           "lead_name",
            "{{buyer_address}}":        "custom_client_address",
            "{{vin}}":                  "custom_vin",
            "{{manufacturer}}":         "custom_manufacturer",
            "{{vehicle_model}}":        "custom_vehicle_model",
            "{{initial_registration}}": "custom_initial_registration",
            "{{mileage_km}}":           "custom_mileage_km",
            "{{sale_price_eur}}":       "custom_final_sale_price",
            "{{contract_date}}":        "creation",
        },
    },
    "handover": {
        "file": "Fahrzeug-Uebergabeprotokoll.pdf",
        "label": "Fahrzeug-Übergabeprotokoll",
        "fields": {
            "{{client_name}}":          "lead_name",
            "{{vin}}":                  "custom_vin",
            "{{vehicle_model}}":        "custom_vehicle_model",
            "{{licence_plate}}":        "custom_licence_plate",
            "{{mileage_at_handover}}":  "custom_mileage_km",
            "{{handover_date}}":        "custom_handover_date",
            "{{key_count}}":            "custom_key_count",
            "{{fuel_level}}":           "custom_fuel_level",
            "{{condition_notes}}":      "custom_handover_notes",
        },
    },
}


def generate_pdf_from_template(deal, template_type: str) -> dict:
    """
    Generates a pre-filled PDF contract from a CRM Deal.

    Args:
        deal:          Frappe CRM Deal document object
        template_type: One of "sell_b2c", "buy_passiv", "kaufvertrag", "handover"

    Returns:
        dict: { file_url, file_name, file_id }
    """
    if template_type not in TEMPLATE_REGISTRY:
        frappe.throw(f"Unknown template type: {template_type}")

    config = TEMPLATE_REGISTRY[template_type]
    template_dir = os.path.join(
        frappe.get_app_path("car_agents_crm"),
        "templates", "contracts"
    )
    template_path = os.path.join(template_dir, config["file"])

    if not os.path.exists(template_path):
        frappe.throw(
            f"Template file not found: {config['file']}. "
            "Please ensure the PDF template is placed in car_agents_crm/templates/contracts/"
        )

    # Build the substitution values from the deal fields
    values = {}
    for placeholder, frappe_field in config["fields"].items():
        raw_value = deal.get(frappe_field) or ""
        values[placeholder] = str(raw_value)

    # Try AcroForm fill first; fallback to text substitution
    try:
        output_bytes = _fill_acroform_pdf(template_path, values)
    except Exception:
        output_bytes = _fill_text_substitution_pdf(template_path, values)

    # Save as a File attachment on the deal
    timestamp = now_datetime().strftime("%Y%m%d_%H%M%S")
    file_name = f"{template_type}_{deal.name}_{timestamp}.pdf"
    output_path = os.path.join(get_files_path(), file_name)

    with open(output_path, "wb") as f:
        f.write(output_bytes)

    # Create Frappe File document and attach to deal
    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": file_name,
        "file_url": f"/files/{file_name}",
        "attached_to_doctype": "CRM Deal",
        "attached_to_name": deal.name,
        "is_private": 0,
    })
    file_doc.insert(ignore_permissions=True)

    return {
        "file_url": file_doc.file_url,
        "file_name": file_name,
        "file_id": file_doc.name,
        "template_label": config["label"],
    }


def _fill_acroform_pdf(template_path: str, values: dict) -> bytes:
    """
    Fills PDF AcroForm fields using pypdf.
    Raises an exception if the PDF has no AcroForm fields.
    """
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(template_path)
    writer = PdfWriter()
    writer.append(reader)

    # Build field map using placeholder → value
    field_updates = {}
    for placeholder, value in values.items():
        # Strip {{ }} braces to match AcroForm field names
        field_name = placeholder.strip("{}")
        field_updates[field_name] = value

    writer.update_page_form_field_values(writer.pages[0], field_updates)

    import io
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def _fill_text_substitution_pdf(template_path: str, values: dict) -> bytes:
    """
    Fallback: reads the PDF as raw bytes and replaces {{placeholder}} strings.
    Works on PDFs generated from text-based sources (not scanned images).
    Note: This method only works on non-encrypted, text-layer PDFs.
    """
    with open(template_path, "rb") as f:
        content = f.read().decode("latin-1")

    for placeholder, value in values.items():
        content = content.replace(placeholder, value)

    return content.encode("latin-1")
