"""
backend/routes/ocr.py
─────────────────────────────────────────────────────────────────────────
KEPT: OCR & document parsing endpoint.
All CRM data storage is now handled by Frappe CRM via car_agents_crm.api.
This route only handles the AI extraction and returns structured JSON.
─────────────────────────────────────────────────────────────────────────
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.claude_service import extract_client_details, extract_vehicle_specs
import tempfile, os

router = APIRouter(prefix="/api/ocr", tags=["OCR"])


@router.post("/client-details")
async def ocr_client_details(file: UploadFile = File(...)):
    """
    Extract personal client details from an uploaded document.
    Used by Frappe car_agents_crm.api.extract_client_details via HTTP bridge.

    Returns: { first_name, last_name, email, phone, address, city,
               postcode, id_number, nationality }
    """
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        result = await extract_client_details(tmp_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


@router.post("/vehicle-specs")
async def ocr_vehicle_specs(file: UploadFile = File(...)):
    """
    Extract vehicle specification data from a Fahrzeugdatenträger /
    Fahrzeugschein image or PDF.
    Used by Frappe car_agents_crm.api.extract_vehicle_specs via HTTP bridge.

    Returns: { vin, manufacturer, model, power_kw, power_ps,
               displacement_ccm, transmission_code, colour_code,
               initial_registration, tuv_expiry, licence_plate }
    """
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        result = await extract_vehicle_specs(tmp_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)
