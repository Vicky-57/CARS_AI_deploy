from pydantic import BaseModel
from typing import Optional

SELL_MILESTONES = [
    "Lead Capture & Contract Signing",
    "Vehicle Document OCR & Spec Extraction",
    "Marketing & Listing",
    "Buyer Inquiry & Test Drives",
    "Sales Closing & Handover",
]

BUY_MILESTONES = [
    "Buyer Requirement Capture",
    "Power of Attorney & Procurement Contract",
    "Car Sourcing & Market Research",
    "Vehicle Inspection & Technical Check",
    "Purchase, Payment & Delivery",
]


class ProjectCreate(BaseModel):
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    project_type: str = "SELL"
    target_vehicle: Optional[str] = None
    vin: Optional[str] = None
    target_price: Optional[float] = None
    agreed_sale_price: Optional[float] = None
    purchase_price: Optional[float] = None
    hourly_rate: Optional[float] = 20.00
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None