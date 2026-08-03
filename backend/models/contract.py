from pydantic import BaseModel
from typing import Optional, Dict, Any


class TemplateEnum:
    VERMITTLUNG = "VERMITTLUNG"
    BESCHAFFUNG = "BESCHAFFUNG"
    KAUFVERTRAG = "KAUFVERTRAG"


class ContractFillRequest(BaseModel):
    lead_id: str
    template_name: str


class ContractGenerateRequest(BaseModel):
    lead_id: str
    template_name: str
    fields: Optional[Dict[str, Any]] = None