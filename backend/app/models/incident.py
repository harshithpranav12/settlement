from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import IncidentStatus
from app.models.analysis_run import AnalysisRunResponse
from app.models.party import PartyResponse


class IncidentBase(BaseModel):
    """Base schema for an accident investigation incident."""

    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Descriptive title of the accident incident",
        examples=["Intersection collision at 5th Ave and Main St"],
    )
    location: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Physical location or intersection where accident occurred",
        examples=["5th Ave & Main St, Springfield"],
    )
    status: IncidentStatus = Field(
        default=IncidentStatus.CREATED,
        description="Current investigation status",
        examples=[IncidentStatus.CREATED],
    )


class IncidentCreate(IncidentBase):
    """Schema for creating a new accident incident."""

    pass


class IncidentUpdate(BaseModel):
    """Schema for updating incident status or details."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    status: Optional[IncidentStatus] = None


class IncidentResponse(IncidentBase):
    """Schema for incident overview response."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}


class IncidentDetailResponse(IncidentResponse):
    """Schema for comprehensive incident response with analysis history and parties."""

    analysis_history: List[AnalysisRunResponse] = Field(
        default_factory=list,
        description="Historical timeline of analytical runs performed for this incident",
    )
    parties: List[PartyResponse] = Field(
        default_factory=list,
        description="Parties (V1, V2) registered to this incident",
    )
    evidence_count: int = Field(
        default=0,
        description="Total pieces of evidence associated with this incident",
    )
    events_count: int = Field(
        default=0,
        description="Total extracted events or claims recorded",
    )
    contradictions_count: int = Field(
        default=0,
        description="Total contradictions identified",
    )
