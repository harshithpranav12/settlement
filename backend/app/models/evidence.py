from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import EvidenceType, PartyLabel, ProcessingStatus


class EvidenceBase(BaseModel):
    """Base schema for uploaded/linked evidence."""

    evidence_type: EvidenceType = Field(
        ...,
        description="Type of evidence submitted",
        examples=[EvidenceType.DASHCAM_VIDEO],
    )
    original_filename: Optional[str] = Field(
        default=None,
        description="Original name of the uploaded evidence file if applicable",
        examples=["front_dashcam_20261030.mp4"],
    )
    storage_reference: str = Field(
        ...,
        description="File path, URI, or relative path outside the database where the file is stored",
        examples=["data/uploads/incidents/inc_123/dashcam_front.mp4"],
    )
    party_id: Optional[str] = Field(
        default=None,
        description="Optional ID of associated party (V1 or V2)",
    )
    evidence_request_id: Optional[str] = Field(
        default=None,
        description="Optional ID of the evidence request that this evidence fulfills",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extensible metadata (e.g., duration, fps, resolution, file hash, sensor specs, statement text)",
    )


class EvidenceCreate(EvidenceBase):
    """Schema for creating a new evidence record."""

    incident_id: str = Field(..., description="Foreign key of the associated incident")
    processing_status: ProcessingStatus = Field(
        default=ProcessingStatus.UPLOADED,
        description="Initial processing status",
    )


class EvidenceUpdate(BaseModel):
    """Schema for updating processing status or metadata."""

    processing_status: Optional[ProcessingStatus] = None
    metadata: Optional[Dict[str, Any]] = None


class EvidenceResponse(EvidenceBase):
    """Schema for returning evidence details."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    upload_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processing_status: ProcessingStatus = ProcessingStatus.UPLOADED

    model_config = {"from_attributes": True}


class WitnessStatementCreate(BaseModel):
    """Schema for submitting structured witness statements as JSON evidence."""

    witness_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Full name or identifier of the witness",
        examples=["Jane Doe"],
    )
    statement: str = Field(
        ...,
        min_length=1,
        description="Verbatim text of the witness statement",
        examples=["I was standing at the bus stop and saw the red car run the light."],
    )
    party_label: Optional[PartyLabel] = Field(
        default=None,
        description="Optional party designator if witness is associated with V1 or V2",
    )
    party_id: Optional[str] = Field(
        default=None,
        description="Optional foreign key if statement belongs to an already registered party",
    )
    evidence_request_id: Optional[str] = Field(
        default=None,
        description="Optional ID of evidence request addressed by this statement",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context (e.g. witness location, contact info, weather observed)",
    )
