from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import PartyLabel


class PartyBase(BaseModel):
    """Base schema for an accident party."""

    party_label: PartyLabel = Field(
        ...,
        description="Party label identifying vehicle role, strictly 'V1' or 'V2'",
        examples=["V1", "V2"],
    )
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Name of the party or driver involved",
        examples=["John Doe"],
    )
    vehicle_registration: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Vehicle registration number or license plate",
        examples=["KA-01-AB-1234"],
    )
    statement: Optional[str] = Field(
        default=None,
        description="Party's reported account or written statement",
        examples=["I was driving north at 40 km/h when V2 turned across my lane."],
    )


class PartyCreate(PartyBase):
    """Schema for registering a party to an existing incident."""

    pass


class PartyUpdate(BaseModel):
    """Schema for updating party details."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    vehicle_registration: Optional[str] = Field(default=None, min_length=1, max_length=64)
    statement: Optional[str] = None


class PartyResponse(PartyBase):
    """Schema for party responses."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}
