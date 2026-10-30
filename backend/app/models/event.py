from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import EventClassification


class ExtractedEventBase(BaseModel):
    """Base schema for an extracted timeline event or party claim."""

    event_type: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Type of event (e.g. collision, lane_change, brake_lights_on, signal_red)",
        examples=["collision", "lane_change"],
    )
    description: str = Field(
        ...,
        min_length=1,
        description="Detailed description of what occurred or was claimed",
        examples=["V1 impacted rear right quarter panel of V2."],
    )
    classification: EventClassification = Field(
        ...,
        description="Epistemic status: observation, claim, or inference",
        examples=[EventClassification.OBSERVATION],
    )
    source_id: Optional[str] = Field(
        default=None,
        description="ID of the originating party (e.g., party_id for a claim) or primary evidence item",
    )

    # Wall-clock real-world timestamps (UTC) - optional for unknown timestamps
    wall_clock_timestamp: Optional[datetime] = Field(
        default=None,
        description="Wall-clock timestamp in UTC when known (can be None for unknown timestamps)",
    )
    wall_clock_end_timestamp: Optional[datetime] = Field(
        default=None,
        description="Optional end of real-world time interval in UTC",
    )

    # Video-relative timestamps kept separately from wall-clock timestamps
    video_offset_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Video-relative start offset in seconds from the beginning of footage",
        examples=[12.4],
    )
    video_end_offset_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Video-relative end offset in seconds for duration intervals",
        examples=[15.8],
    )

    evidence_references: List[str] = Field(
        default_factory=list,
        description="List of associated evidence IDs or media segment identifiers",
    )
    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional event attributes (e.g. speed_kmh, lane_number, bounding_box)",
    )


class ExtractedEventCreate(ExtractedEventBase):
    """Schema for creating a new extracted event."""

    incident_id: str = Field(..., description="Foreign key of the associated incident")


class ExtractedEventUpdate(BaseModel):
    """Schema for updating an extracted event."""

    description: Optional[str] = None
    classification: Optional[EventClassification] = None
    wall_clock_timestamp: Optional[datetime] = None
    wall_clock_end_timestamp: Optional[datetime] = None
    video_offset_seconds: Optional[float] = None
    video_end_offset_seconds: Optional[float] = None
    confidence: Optional[float] = None
    evidence_references: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class ExtractedEventResponse(ExtractedEventBase):
    """Schema for extracted event response."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}
