"""Pydantic schemas for multi-modal forensic timeline reconstruction."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import EventClassification


class TimelineTimeType(str, Enum):
    """Categorization of temporal referencing for timeline items."""

    WALL_CLOCK = "wall_clock"          # Calibrated real-world UTC timestamp
    VIDEO_RELATIVE = "video_relative"  # Offset in seconds relative to specific video
    UNANCHORED = "unanchored"          # Time unknown or contextual without timestamp


class TimePrecision(str, Enum):
    """Temporal resolution of an event timestamp."""

    MILLISECOND = "millisecond"
    SECOND = "second"
    MINUTE = "minute"
    INTERVAL = "interval"
    FRAME = "frame"
    UNKNOWN = "unknown"


class TimelineItem(BaseModel):
    """Individual normalized timeline item from witness statements, sensors, or video."""

    id: str = Field(..., description="ID of the underlying extracted event")
    incident_id: str
    time_type: TimelineTimeType
    timestamp: Optional[datetime] = Field(
        default=None,
        description="Wall-clock start timestamp in UTC when known",
    )
    end_timestamp: Optional[datetime] = Field(
        default=None,
        description="Wall-clock end timestamp in UTC for intervals",
    )
    video_offset_seconds: Optional[float] = Field(
        default=None,
        description="Video-relative start offset in seconds",
    )
    video_end_offset_seconds: Optional[float] = Field(
        default=None,
        description="Video-relative end offset in seconds for intervals",
    )
    duration_seconds: Optional[float] = Field(
        default=None,
        description="Duration of the event interval in seconds",
    )
    display_time: str = Field(
        ...,
        description="Human-readable representation of time anchor",
        examples=["2026-10-30 14:00:05.200 UTC", "+10.50s [Video: VID001]", "Time Unknown / Unanchored"],
    )
    time_precision: TimePrecision = Field(
        default=TimePrecision.SECOND,
        description="Recorded precision of the event timestamp",
    )
    is_synchronized: bool = Field(
        default=False,
        description="True if video-relative time was mapped to wall-clock via an explicit sync offset",
    )
    sync_offset_applied_seconds: Optional[float] = Field(
        default=None,
        description="Synchronization offset applied in seconds if synchronized",
    )
    event_type: str = Field(..., description="Type of event or pattern")
    classification: EventClassification = Field(..., description="Epistemic status: observation, claim, or inference")
    description: str = Field(..., description="Detailed description of what occurred or was claimed")
    source_id: Optional[str] = Field(default=None, description="Originating party or equipment identifier")
    evidence_references: List[str] = Field(default_factory=list, description="Associated evidence IDs")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TimelineOccurrence(BaseModel):
    """Cluster of multiple events describing the same physical occurrence with adequate supporting evidence."""

    occurrence_id: str = Field(default_factory=lambda: str(uuid4()))
    title: str = Field(..., description="Synthesized title of the correlated occurrence")
    description: str = Field(..., description="Synthesized narrative across corroborating sources")
    time_anchor: Optional[str] = Field(default=None, description="Primary timestamp or offset of the occurrence")
    time_type: TimelineTimeType
    participating_event_ids: List[str] = Field(default_factory=list)
    event_types: List[str] = Field(default_factory=list)
    classifications: List[EventClassification] = Field(default_factory=list)
    sources: List[str] = Field(default_factory=list)
    evidence_references: List[str] = Field(default_factory=list)
    supporting_sources_count: int = Field(default=1)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class VideoTrackTimeline(BaseModel):
    """Chronologically sorted sequence of events from a single video source."""

    evidence_id: str
    video_filename: Optional[str] = None
    items_count: int
    is_synchronized: bool = False
    sync_wall_clock_start: Optional[datetime] = None
    items: List[TimelineItem] = Field(default_factory=list)


class TimelineSyncRequest(BaseModel):
    """Optional request parameters for timeline retrieval and synchronization."""

    video_sync_offsets: Optional[Dict[str, datetime]] = Field(
        default=None,
        description="Mapping from video evidence ID (or filename) to its wall-clock UTC start time",
    )
    group_occurrences: bool = Field(
        default=True,
        description="Whether to cluster correlated events with adequate supporting evidence",
    )


class TimelineResponse(BaseModel):
    """Structured multi-modal timeline response."""

    incident_id: str
    total_events: int
    synchronized: bool
    applied_sync_offsets: Dict[str, str] = Field(default_factory=dict)
    chronological_timeline: List[TimelineItem] = Field(
        default_factory=list,
        description="Chronologically sorted timeline (real-world and synchronized events first, then unanchored)",
    )
    occurrences: List[TimelineOccurrence] = Field(
        default_factory=list,
        description="Correlated multi-source occurrences where adequate supporting information exists",
    )
    video_tracks: Dict[str, VideoTrackTimeline] = Field(
        default_factory=dict,
        description="Independent video-relative tracks kept separate when uncalibrated",
    )
    unanchored_events: List[TimelineItem] = Field(
        default_factory=list,
        description="Events/claims with unknown timestamps",
    )
    disclaimer: str = Field(
        default=(
            "Timeline reconstruction synthesizes testimonial claims, video detections, and sensor measurements. "
            "Video-relative time is kept separate from real-world UTC time unless explicitly synchronized. "
            "Unanchored claims are preserved without fabricating timestamps."
        ),
        description="Forensic integrity disclaimer",
    )
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}
