import tempfile
import os
from fastapi import APIRouter, HTTPException
from app.schemas.contract import ContractGenerateRequest, ContractGenerateResponse
from app.services.pdf_service import fill_contract_template

router = APIRouter(prefix="/contracts", tags=["Contract Generation"])


@router.post("/generate-pdf", response_model=ContractGenerateResponse)
async def generate_contract_pdf(req: ContractGenerateRequest):
    """
    1-Click Contract Pre-filling & PDF Generation for the 4 CAR-AGENTS templates:
      1. sell_b2c      → Vermittlungsvertrag B2C Aktiv
      2. buy_passiv    → Vermittlungsvertrag Beschaffung Passiv
      3. kaufvertrag   → Kaufvertrag C2C Bilingual
      4. handover      → Fahrzeug-Übergabeprotokoll
    """
    try:
        output_dir = tempfile.gettempdir()
        result = fill_contract_template(req.template_type, req.custom_data or {}, output_dir)
        return ContractGenerateResponse(
            success=result["success"],
            template_label=result["template_label"],
            file_name=result["file_name"],
            file_path=result["file_path"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contract generation failed: {str(e)}")
