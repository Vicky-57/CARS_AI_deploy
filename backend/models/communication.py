from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class MessageTypeEnum(str, Enum):
    EMAIL = "EMAIL"
    WHATSAPP = "WHATSAPP"


class CommunicationOut(BaseModel):
    id: str
    lead_id: Optional[str] = None
    channel: MessageTypeEnum
    sender_name: Optional[str] = None
    sender_contact: Optional[str] = None  # email or phone
    subject: Optional[str] = None
    body: str
    is_inbound: bool = True
    ai_summary: Optional[str] = None
    intent: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True
