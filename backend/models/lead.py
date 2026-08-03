from pydantic import BaseModel
from typing import Optional


class LeadCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    channel: Optional[str] = "MANUAL"
    intent: Optional[str] = "UNKNOWN"
    status: Optional[str] = "NEW"
    message: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    vin: Optional[str] = None
    license_plate: Optional[str] = None
    initial_registration: Optional[str] = None
    mileage: Optional[str] = None
    power_ps: Optional[str] = None
    displacement_ccm: Optional[str] = None
    tuev_until: Optional[str] = None
    price_limit: Optional[float] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class LeadOut(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    channel: Optional[str] = None
    intent: Optional[str] = None
    status: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    vin: Optional[str] = None
    license_plate: Optional[str] = None
    initial_registration: Optional[str] = None
    mileage: Optional[str] = None
    power_ps: Optional[str] = None
    displacement_ccm: Optional[str] = None
    tuev_until: Optional[str] = None
    price_limit: Optional[float] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None