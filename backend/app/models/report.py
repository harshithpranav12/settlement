"""Pydantic schemas for structured forensic investigation reports."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.contradiction_engine import ContradictionFinding, MissingEvidenceItem
from app.models.enums import EventClassification, IncidentStatus, PartyLabel
from app.models.timeline import TimelineItem


class PartyStatementRecord(BaseModel):
    """Party record with verbatim statement preserved."""
    party_label: PartyLabel
    name: str
    vehicle_registration: str
    statement: Optional[str] = None


class VideoObservationRef(BaseModel):
    """Verified visual observation with frame and source reference."""
    source_id: str
    frame_number: Optional[int] = None
    timestamp_seconds: Optional[float] = None
    vehicle_id: str = Field(..., description="Algorithm-generated track identifier")
    detected_class: str = "car"
    bbox: Optional[Dict[str, float]] = None
    confidence: Optional[float] = Field(None, description="Raw model confidence, not calibrated probability")
    description: str


class SensorObservationRef(BaseModel):
    """Sensor telematics observation with row number and source reference."""
    evidence_id: str
    source_filename: str
    row_number: int
    timestamp: Optional[str] = None
    relative_seconds: Optional[float] = None
    speed_kmh: Optional[float] = None
    event_type: str
    description: str


class EvidenceFindingRef(BaseModel):
    """Evidence support reference for a specific finding."""
    finding_id: str
    description: str
    classification: EventClassification
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    confidence_assessment: str = Field(
        ...,
        description="Qualitative confidence assessment without uncalibrated probabilistic claims"
    )


class InvestigationReportResponse(BaseModel):
    """Comprehensive structured forensic investigation report.

    Contains all 10 required forensic sections, clearly distinguishing
    direct observations, witness claims, and forensic inferences,
    without determining legal liability or declaring fault.
    """

    report_id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    analysis_run_id: Optional[str] = None
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Section 1: Incident Summary
    incident_summary: Dict[str, Any] = Field(
        ...,
        description="Section 1: Incident metadata including ID, title, location, status, and created date"
    )

    # Section 2: Parties and Original Statements
    parties: List[PartyStatementRecord] = Field(
        ...,
        description="Section 2: Involved parties and their verbatim original statements"
    )

    # Section 3: Chronological Timeline
    timeline: List[TimelineItem] = Field(
        ...,
        description="Section 3: Unified chronological sequence of observations, claims, and verified events"
    )

    # Section 4: Video Observations & Source Frame References
    video_observations: List[VideoObservationRef] = Field(
        default_factory=list,
        description="Section 4: Computer-vision detections with source video IDs, frame numbers, and pixel bboxes"
    )

    # Section 5: Sensor Observations & Source Row References
    sensor_observations: List[SensorObservationRef] = Field(
        default_factory=list,
        description="Section 5: Kinematic sensor telemetry with source CSV row numbers and speed/brake states"
    )

    # Section 6: Conflicting Claims
    conflicting_claims: List[ContradictionFinding] = Field(
        default_factory=list,
        description="Section 6: Factual incompatibilities identified between statements or telemetry"
    )

    # Section 7: Evidence Supporting Each Finding
    evidence_support: List[EvidenceFindingRef] = Field(
        default_factory=list,
        description="Section 7: Traceability links connecting findings to physical evidence records"
    )

    # Section 8: Unresolved Questions and Missing Evidence
    unresolved_questions: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Section 8: Open factual questions remaining due to missing or contradictory information"
    )
    missing_evidence: List[MissingEvidenceItem] = Field(
        default_factory=list,
        description="Section 8b: Specific evidence items requested or needed to resolve open questions"
    )

    # Section 9: Limitations of Available Evidence
    evidence_limitations: List[str] = Field(
        ...,
        description="Section 9: Methodological and evidentiary constraints (blind spots, pixel coordinates, absence caveats)"
    )

    # Section 10: Concise Evidence-Grounded Summary
    executive_summary: str = Field(
        ...,
        description="Section 10: Factual, evidence-grounded summary summarizing verified timeline and open conflicts"
    )

    # Forensic & Legal Disclaimer
    disclaimer: str = Field(
        default=(
            "TRACE AI produces objective, evidence-grounded forensic reconstructions. "
            "It does not assess civil liability, criminal culpability, or insurance fault. "
            "All model confidence scores represent raw extraction metrics, not calibrated Bayesian probabilities."
        ),
        description="Forensic and legal boundary disclaimer"
    )

    model_config = {"from_attributes": True}
