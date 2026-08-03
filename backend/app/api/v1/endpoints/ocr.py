import tempfile
import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.pdf_service import extract_document_text
from app.services.claude_service import extract_client_details, extract_vehicle_specs
from app.schemas.ocr import ClientDetailsResponse, VehicleSpecsResponse

router = APIRouter(prefix="/ocr", tags=["OCR Extraction"])


@router.post("/client-details", response_model=ClientDetailsResponse)
async def ocr_client_details(file: UploadFile = File(...)):
    """
    Upload a client identity or follow-up document (PDF / Image).
    Extracts client personal details (name, email, phone, address, ID number).
    """
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
    """
    Upload a German Fahrzeugdatenträger or Fahrzeugschein document (PDF / Image).
    Extracts vehicle specs (VIN, manufacturer, model, power, displacement, EZ, TÜV).
    """
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
