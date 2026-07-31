from fastapi import APIRouter, HTTPException
from models.contract import ContractFillRequest, ContractGenerateRequest, TemplateEnum
from services import supabase_service as db

router = APIRouter(prefix="/api/contracts", tags=["Contracts"])


TEMPLATES = [
    {
        "id": "VERMITTLUNG",
        "name": "Verbindlicher Vermittlungsvertrag (Verkauf)",
        "file": "CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf",
        "type": "SELL",
        "description": "Standard broker-seller contract for private car sale.",
    },
    {
        "id": "BESCHAFFUNG",
        "name": "Vermittlungsvertrag Beschaffung (Kauf)",
        "file": "CAR-AGENTS_Vermittlungsvertrag_Beschaffung_Final__passiv.pdf",
        "type": "BUY",
        "description": "Broker-buyer contract for car sourcing & procurement.",
    },
    {
        "id": "KAUFVERTRAG",
        "name": "Kaufvertrag (C2C Bilingual)",
        "file": "Kaufvertrag-C2C-Bilingual.pdf",
        "type": "SELL",
        "description": "Bilingual purchase agreement for private car sale (DE/EN).",
    },
]


@router.get("/templates")
def list_templates():
    return TEMPLATES


@router.post("/fill")
async def fill_contract(request: ContractFillRequest):
    """Step 3 of wizard: fetch lead data from DB and auto-populate contract fields."""
    lead = db.get_lead_by_id(request.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Build pre-filled fields from lead data
    fields = {
        "client_name": lead.get("name"),
        "client_phone": lead.get("phone"),
        "client_email": lead.get("email"),
        "manufacturer": lead.get("manufacturer"),
        "model": lead.get("model"),
        "vin": lead.get("vin"),
        "license_plate": lead.get("license_plate"),
        "initial_registration": lead.get("initial_registration"),
        "mileage": lead.get("mileage"),
        "power_ps": lead.get("power_ps"),
        "displacement_ccm": lead.get("displacement_ccm"),
        "tuev_until": lead.get("tuev_until"),
        "price_limit": lead.get("price_limit"),
        "notes": lead.get("notes"),
    }
    return {
        "lead_id": request.lead_id,
        "template_name": request.template_name,
        "client_name": lead.get("name"),
        "fields": fields,
    }


@router.post("/generate-pdf")
async def generate_pdf(request: ContractGenerateRequest):
    """Receive verified form fields → generate a filled contract PDF (stub for now)."""
    # TODO: integrate actual PDF form filling with pypdf / pdfrw / Word template
    return {
        "status": "ok",
        "message": "PDF generation queued.",
        "lead_id": request.lead_id,
        "template": request.template_name,
        "fields_received": len(request.fields),
    }
