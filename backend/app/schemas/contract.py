from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class ContractGenerateRequest(BaseModel):
    template_type: str = Field(
        ...,
        description="One of: 'sell_b2c', 'buy_passiv', 'kaufvertrag', 'handover'"
    )
    deal_id: Optional[str] = Field(None, description="Optional Project/Deal ID from Supabase")
    custom_data: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Dynamic field replacements for contract placeholders e.g. {{client_name}}, {{vin}}, {{price_limit}}"
    )


class ContractGenerateResponse(BaseModel):
    success: bool
    template_label: str
    file_name: str
    file_path: str
    pdf_base64: Optional[str] = None
