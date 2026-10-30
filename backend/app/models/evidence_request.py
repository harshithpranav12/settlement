from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import EvidenceRequestStatus


class EvidenceRequestBase(BaseModel):
    """Base schema for an evidence request in an incident investigation."""

    request_type: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Type of evidence being requested",
        examples=["cctv_footage", "dashcam_video", "driver_statement", "telematics_data"],
    )
    description: str = Field(
        ...,
        min_length=1,
        description="Specific instructions or scope of the requested evidence",
        examples=["Request municipal traffic camera footage between 14:10 and 14:20 UTC."],
    )
    target_party: Optional[str] = Field(
        default=None,
        description="Party or authority from whom evidence is requested (e.g. V1, V2, Traffic Police)",
        examples=["V1", "City Traffic Department"],
    )
    status: EvidenceRequestStatus = Field(
        default=EvidenceRequestStatus.PENDING,
        description="Current fulfillment status",
    )
    fulfilled_evidence_id: Optional[str] = Field(
        default=None,
        description="ID of the evidence record that satisfied this request",
    )


class EvidenceRequestCreate(EvidenceRequestBase):
    """Schema for creating a new evidence request."""

    incident_id: str = Field(..., description="Foreign key of the associated incident")


class EvidenceRequestUpdate(BaseModel):
    """Schema for updating evidence request status."""

    status: Optional[EvidenceRequestStatus] = None
    fulfilled_evidence_id: Optional[str] = None
    description: Optional[str] = None


class EvidenceRequestResponse(EvidenceRequestBase):
    """Schema for returning evidence request details."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}
