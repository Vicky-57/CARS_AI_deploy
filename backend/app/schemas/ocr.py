from pydantic import BaseModel, Field
from typing import Optional


class ClientDetailsResponse(BaseModel):
    first_name: Optional[str] = Field(None, description="First name of the client")
    last_name: Optional[str] = Field(None, description="Last name of the client")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    address: Optional[str] = Field(None, description="Street address")
    city: Optional[str] = Field(None, description="City")
    postcode: Optional[str] = Field(None, description="Postal code")
    id_number: Optional[str] = Field(None, description="ID / Passport number")
    nationality: Optional[str] = Field(None, description="Nationality")


class VehicleSpecsResponse(BaseModel):
    vin: Optional[str] = Field(None, description="17-digit Vehicle Identification Number")
    manufacturer: Optional[str] = Field(None, description="Vehicle manufacturer e.g. Volkswagen, Porsche")
    model: Optional[str] = Field(None, description="Vehicle model e.g. Multivan, 911 GT3")
    power_kw: Optional[int] = Field(None, description="Engine power in kW")
    power_ps: Optional[int] = Field(None, description="Engine power in PS")
    displacement_ccm: Optional[int] = Field(None, description="Engine displacement in ccm")
    transmission_code: Optional[str] = Field(None, description="Transmission code")
    colour_code: Optional[str] = Field(None, description="Colour / Paint code")
    initial_registration: Optional[str] = Field(None, description="Initial registration date (EZ)")
    tuv_expiry: Optional[str] = Field(None, description="TÜV inspection expiry date")
    licence_plate: Optional[str] = Field(None, description="License plate (Kennzeichen)")
    mileage: Optional[int] = Field(None, description="Mileage in km")
