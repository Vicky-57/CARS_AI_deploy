import tempfile
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.schemas.contract import ContractGenerateRequest, ContractGenerateResponse
from app.services.pdf_service import fill_contract_template
from app.services.gdrive_service import upload_approved_contract_to_drive

router = APIRouter(prefix="/contracts", tags=["Contract Generation & Google Drive Storage"])


class ApproveContractRequest(BaseModel):
    customer_name: str = Field(..., description="Full customer name for folder creation")
    contract_filename: str = Field(..., description="Name of the generated contract PDF")
    file_path: str = Field(..., description="Absolute path of the generated PDF file")


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


@router.post("/approve-and-upload")
async def approve_and_upload_contract(req: ApproveContractRequest):
    """
    Called ONLY AFTER client/broker explicitly approves that the generated contract template is correct.
    Saves/uploads the PDF to Google Drive under /CAR-AGENTS/Customers/{Customer Name}/Contracts/
    """
    try:
        res = await upload_approved_contract_to_drive(
            customer_name=req.customer_name,
            contract_filename=req.contract_filename,
            pdf_file_path=req.file_path
        )
        if not res.get("success"):
            raise HTTPException(status_code=500, detail=res.get("error", "Drive upload failed"))
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google Drive upload failed: {str(e)}")
