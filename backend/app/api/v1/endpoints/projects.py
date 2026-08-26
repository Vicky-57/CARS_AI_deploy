from fastapi import APIRouter
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.schemas.project import NetProfitCalculation
from app.services.calculator_service import calculate_net_profit

router = APIRouter(prefix="/projects", tags=["Brokerage Projects & Profit Calculator"])


class ProfitCalculateRequest(BaseModel):
    purchase_price: float = Field(0.0, description="Vehicle purchase price")
    agreed_sale_price: float = Field(0.0, description="Agreed final sale price")
    hourly_rate: float = Field(20.0, description="Broker hourly labor rate in EUR (Default 20.0)")
    expenses: List[Dict[str, Any]] = Field(default_factory=list, description="Itemized receipt expenses")
    labor_entries: List[Dict[str, Any]] = Field(default_factory=list, description="Logged labor hours")


@router.post("/calculate-profit", response_model=NetProfitCalculation)
async def calculate_project_profit(req: ProfitCalculateRequest):
    """
    Computes Net Broker Profit, Labor Costs, and Total Investment according to the CAR-AGENTS formula:
      Total Expenses           = SUM(receipt amounts)
      Labor Cost               = Labor Hours * Hourly Rate (Default €20/hr)
      Total Project Investment = Vehicle Purchase Price + Total Expenses + Labor Cost
      Net Broker Profit        = Agreed Final Sale Price - Total Project Investment
    """
    result = calculate_net_profit(
        purchase_price=req.purchase_price,
        agreed_sale_price=req.agreed_sale_price,
        hourly_rate=req.hourly_rate,
        expenses=req.expenses,
        labor_entries=req.labor_entries
    )
    return result


@router.get("/{project_id}/drive-folders")
async def get_project_drive_folders(project_id: str, client_name: Optional[str] = "Customer"):
    """Get or create direct 3-tier Google Drive folder URLs for a customer project."""
    try:
        from app.services.gdrive_service import create_customer_folder_structure
        struct = create_customer_folder_structure(client_name, project_id)
        return {
            "success": True,
            "project_id": project_id,
            "customer_folder_id": struct["customer_folder_id"],
            "customer_folder_url": f"https://drive.google.com/drive/folders/{struct['customer_folder_id']}",
            "ocr_folder_id": struct["ocr_folder_id"],
            "ocr_folder_url": f"https://drive.google.com/drive/folders/{struct['ocr_folder_id']}",
            "legal_docs_folder_id": struct["legal_docs_folder_id"],
            "legal_docs_folder_url": f"https://drive.google.com/drive/folders/{struct['legal_docs_folder_id']}",
            "signed_docs_folder_id": struct["signed_docs_folder_id"],
            "signed_docs_folder_url": f"https://drive.google.com/drive/folders/{struct['signed_docs_folder_id']}",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


from fastapi import UploadFile, File, Form

@router.post("/{project_id}/upload-drive-file")
async def upload_file_to_project_drive(
    project_id: str,
    file: UploadFile = File(...),
    client_name: str = Form("Customer"),
    target_folder: str = Form("1. OCR")
):
    """Upload images, videos, or documents directly into customer's Google Drive folder."""
    try:
        from app.services.gdrive_service import create_customer_folder_structure, upload_file_to_drive_folder
        struct = create_customer_folder_structure(client_name, project_id)
        
        if target_folder == "3. Signed Docs":
            folder_id = struct["signed_docs_folder_id"]
        elif target_folder == "2. Legal Docs":
            folder_id = struct["legal_docs_folder_id"]
        else:
            folder_id = struct["ocr_folder_id"]

        file_bytes = await file.read()
        res = upload_file_to_drive_folder(
            parent_folder_id=folder_id,
            filename=file.filename,
            file_bytes=file_bytes,
            mime_type=file.content_type or "application/octet-stream"
        )

        return {
            "success": True,
            "filename": file.filename,
            "file_id": res.get("file_id"),
            "drive_url": res.get("webViewLink"),
            "folder_name": target_folder
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
