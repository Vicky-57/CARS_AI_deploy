"""
app/api/v1/endpoints/ocr.py
────────────────────────────────────────────────────────────────────────
OCR Document Parsing & Missing-Fields Audit Engine

Endpoints:
  POST /ocr/client-details  → Extract client identity fields
  POST /ocr/vehicle-specs   → Extract vehicle specs
  POST /ocr/audit-document  → Full audit: extracted fields vs. missing fields checklist
────────────────────────────────────────────────────────────────────────
"""
import tempfile
import os
from typing import Dict, List, Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from app.services.pdf_service import extract_document_text
from app.services.claude_service import extract_client_details, extract_vehicle_specs
from app.schemas.ocr import ClientDetailsResponse, VehicleSpecsResponse

router = APIRouter(prefix="/ocr", tags=["OCR & Document Audit"])

# Standard required fields for contract generation
MANDATORY_CONTRACT_FIELDS = [
    {"key": "vin", "label": "17-Digit VIN (Fahrzeug-Identifizierungsnummer)", "source": "Fahrzeugschein / Datenträger"},
    {"key": "make", "label": "Manufacturer / Make (Hersteller)", "source": "Fahrzeugschein / Datenträger"},
    {"key": "model", "label": "Model (Modell / Typ)", "source": "Fahrzeugschein / Datenträger"},
    {"key": "power_kw", "label": "Engine Power kW/PS (Leistung)", "source": "Fahrzeugschein / Datenträger"},
    {"key": "displacement_ccm", "label": "Engine Displacement (Hubraum ccm)", "source": "Fahrzeugschein / Datenträger"},
    {"key": "registration_date", "label": "First Registration Date (Erstzulassung)", "source": "Fahrzeugschein Teil I (Field B)"},
    {"key": "license_plate", "label": "License Plate (Kennzeichen)", "source": "Fahrzeugschein Teil I (Field A)"},
    {"key": "zb2_number", "label": "ZB II Document Number (Nummer Zulassungsbescheinigung Teil II)", "source": "Fahrzeugschein Teil II"},
    {"key": "tuev_date", "label": "TÜV / HU Expiry Date (Nächste Hauptuntersuchung)", "source": "Fahrzeugschein or Inspection Report"},
    {"key": "mileage", "label": "Mileage (Kilometerstand)", "source": "Odometer / Client Form"},
    {"key": "asking_price", "label": "Asking / Target Price (Verkaufspreis / Preislimit)", "source": "Client Form"},
    {"key": "storage_option", "label": "Storage Option A / B / C (Verwahrungsoption)", "source": "Client Form (Handover Protocol)"},
    {"key": "previous_owners", "label": "Previous Owners Count (Anzahl Vorhalter)", "source": "Fahrzeugschein Teil II"},
]


class DocumentAuditResponse(BaseModel):
    document_name: str
    document_type_detected: str
    extracted_fields: Dict[str, Any]
    missing_fields: List[Dict[str, str]]
    completion_percentage: int
    ready_for_contract: bool
    checklist_for_client: List[str]


@router.post("/client-details", response_model=ClientDetailsResponse)
async def ocr_client_details(file: UploadFile = File(...)):
    """Extract client personal details from identity / intake documents."""
    suffix = os.path.splitext(file.filename or "doc")[1] or ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        raw_text = extract_document_text(tmp_path)
        extracted = await extract_client_details(raw_text)
        return extracted
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/vehicle-specs", response_model=VehicleSpecsResponse)
async def ocr_vehicle_specs(file: UploadFile = File(...)):
    """Extract vehicle specs from German Fahrzeugdatenträger / Fahrzeugschein."""
    suffix = os.path.splitext(file.filename or "image")[1] or ".jpeg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        raw_text = extract_document_text(tmp_path)
        extracted = await extract_vehicle_specs(raw_text)
        return extracted
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/audit-document", response_model=DocumentAuditResponse)
async def audit_vehicle_document(file: UploadFile = File(...)):
    """
    Scans a vehicle document, extracts all available fields, and conducts an audit
    identifying which fields are present vs. which mandatory contract fields are missing.
    Returns an actionable checklist of items Maxim needs to request from the customer.
    """
    suffix = os.path.splitext(file.filename or "doc")[1] or ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        raw_text = extract_document_text(tmp_path)
        specs = await extract_vehicle_specs(raw_text)
        specs_dict = specs.model_dump() if hasattr(specs, "model_dump") else dict(specs)

        # Detect document type
        raw_lower = raw_text.lower()
        if "zulassungsbescheinigung" in raw_lower or "bundesrepublik" in raw_lower:
            doc_type = "Fahrzeugschein (Zulassungsbescheinigung)"
        elif "fahrzeugdatenträger" in raw_lower or "kundendienst" in raw_lower:
            doc_type = "Fahrzeugdatenträger (Parts Reference Card)"
        else:
            doc_type = "Vehicle Document / Spec Sheet"

        # Compare against mandatory fields
        missing = []
        present_count = 0
        checklist = []

        for field in MANDATORY_CONTRACT_FIELDS:
            key = field["key"]
            val = specs_dict.get(key)
            if val and str(val).strip() and str(val).lower() not in ("none", "null", ""):
                present_count += 1
            else:
                missing.append({
                    "field_key": key,
                    "label": field["label"],
                    "how_to_obtain": f"Request from client: {field['source']}"
                })
                checklist.append(f"Please provide: {field['label']} ({field['source']})")

        total_fields = len(MANDATORY_CONTRACT_FIELDS)
        completion_pct = int((present_count / total_fields) * 100)

        return {
            "document_name": file.filename or "uploaded_document",
            "document_type_detected": doc_type,
            "extracted_fields": specs_dict,
            "missing_fields": missing,
            "completion_percentage": completion_pct,
            "ready_for_contract": len(missing) == 0,
            "checklist_for_client": checklist,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
