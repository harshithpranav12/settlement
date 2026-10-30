from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import ContradictionSeverity, ContradictionStatus


class ContradictionBase(BaseModel):
    """Base schema for an identified timeline or factual contradiction."""

    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Summary title of the contradiction",
        examples=["Traffic Light Signal Status Conflict"],
    )
    description: str = Field(
        ...,
        min_length=1,
        description="Detailed explanation of conflicting claims or evidence",
        examples=["V1 claims traffic signal was green, but junction CCTV at t=14s shows light was red."],
    )
    event_id_a: Optional[str] = Field(
        default=None,
        description="Reference to first conflicting event/claim",
    )
    event_id_b: Optional[str] = Field(
        default=None,
        description="Reference to second conflicting event/claim",
    )
    severity: ContradictionSeverity = Field(
        default=ContradictionSeverity.MODERATE,
        description="Severity classification of the contradiction",
    )
    status: ContradictionStatus = Field(
        default=ContradictionStatus.DETECTED,
        description="Investigation state of this contradiction",
    )


class ContradictionCreate(ContradictionBase):
    """Schema for recording a new contradiction."""

    incident_id: str = Field(..., description="Foreign key of the associated incident")


class ContradictionUpdate(BaseModel):
    """Schema for updating contradiction status or resolution notes."""

    status: Optional[ContradictionStatus] = None
    severity: Optional[ContradictionSeverity] = None
    description: Optional[str] = None


class ContradictionResponse(ContradictionBase):
    """Schema for contradiction response."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}
