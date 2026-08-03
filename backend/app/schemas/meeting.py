from pydantic import BaseModel, Field
from typing import Optional, List


class ConflictCheckRequest(BaseModel):
    proposed_start: str = Field(..., description="ISO datetime string e.g. '2026-08-05T10:00:00Z'")
    proposed_end: str = Field(..., description="ISO datetime string e.g. '2026-08-05T11:00:00Z'")
    is_onsite: bool = Field(True, description="Apply 30-minute travel buffer for offline/onsite meetings")


class ConflictingEvent(BaseModel):
    id: str
    title: str
    start_time: str
    end_time: str
    location_type: str


class ConflictCheckResponse(BaseModel):
    has_conflict: bool
    buffer_applied_minutes: int
    checked_start: str
    checked_end: str
    conflicting_events: List[ConflictingEvent] = []
