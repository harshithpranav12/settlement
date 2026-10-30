"""Pydantic schemas for forensic contradiction detection and claim verification."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import ContradictionSeverity, ContradictionStatus


class ConflictType(str, Enum):
    """Classification of the conflicting evidentiary domains."""

    CLAIM_VS_CLAIM = "claim_vs_claim"               # Divergence between two party statements
    CLAIM_VS_SENSOR = "claim_vs_sensor"             # Party claim contradicts sensor telematics
    CLAIM_VS_VIDEO = "claim_vs_video"               # Party claim contradicts video machine observations
    TEMPORAL_SEQUENCE = "temporal_sequence"         # Conflicting chronological order of events
    PHYSICAL_INCOMPATIBILITY = "physical_incompatibility"


class ContradictionFinding(BaseModel):
    """Detailed forensic contradiction finding."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    conflict_type: ConflictType
    title: str = Field(..., description="Short summary title of the contradiction")
    description: str = Field(..., description="Objective forensic explanation of the factual divergence")
    topic: str = Field(..., description="Subject matter (e.g. speed, traffic_signal, braking, lane_position)")
    severity: ContradictionSeverity = Field(default=ContradictionSeverity.MODERATE)
    status: ContradictionStatus = Field(default=ContradictionStatus.DETECTED)

    event_id_a: Optional[str] = Field(default=None, description="Primary event/claim ID")
    event_id_b: Optional[str] = Field(default=None, description="Conflicting event/observation ID")
    source_a: Optional[str] = Field(default=None, description="Originating party or sensor source A")
    source_b: Optional[str] = Field(default=None, description="Originating party or observation source B")
    claim_a_id: Optional[str] = Field(default=None, description="Claim ID for party A if applicable")
    claim_b_id: Optional[str] = Field(default=None, description="Claim ID for party B if applicable")
    quote_a: Optional[str] = Field(default=None, description="Verbatim statement or measurement from A")
    quote_b: Optional[str] = Field(default=None, description="Verbatim statement or measurement from B")
    timestamp_a: Optional[str] = Field(default=None, description="Timestamp or time window for A")
    timestamp_b: Optional[str] = Field(default=None, description="Timestamp or time window for B")

    supporting_observation_ids: List[str] = Field(
        default_factory=list,
        description="IDs of extracted observation events corroborating or establishing this conflict",
    )
    evidence_references: List[str] = Field(
        default_factory=list,
        description="Relevant evidence items (CCTV, sensor CSV, dashcam)",
    )
    is_direct_contradiction: bool = Field(
        default=True,
        description="True if claims/observations are mutually exclusive; False if difference in wording/granularity",
    )
    resolution_rationale: Optional[str] = Field(
        default=None,
        description="Objective basis for resolution or explanation why it remains unresolved",
    )
    missing_evidence_notes: Optional[str] = Field(
        default=None,
        description="Notes regarding missing telemetry or camera coverage required for definitive resolution",
    )
    recommended_evidence_type: Optional[str] = Field(
        default=None,
        description="Evidence type that could definitively resolve the contradiction",
    )


class CompatibleStatementItem(BaseModel):
    """Pair of statements or measurements that agree or differ only in minor wording."""

    topic: str
    summary: str
    source_a: str
    source_b: str
    quote_a: str
    quote_b: str
    notes: str = "Statements are compatible across available evidence."


class MissingEvidenceItem(BaseModel):
    """Claim that currently lacks corroborating or refuting evidence (NOT a contradiction)."""

    source_id: str
    claim_text: str
    topic: str
    camera_coverage_note: str = (
        "Absence from video footage or sensor telemetry does not constitute proof of non-occurrence."
    )
    suggested_evidence: Optional[str] = None


class ContradictionEngineResponse(BaseModel):
    """Comprehensive contradiction detection and claim verification response."""

    incident_id: str
    total_contradictions: int
    direct_contradictions_count: int
    unresolved_count: int
    findings: List[ContradictionFinding] = Field(default_factory=list)
    compatible_statements: List[CompatibleStatementItem] = Field(default_factory=list)
    missing_evidence_items: List[MissingEvidenceItem] = Field(default_factory=list)
    forensic_disclaimer: str = Field(
        default=(
            "Contradiction detection identifies factual incompatibilities between claims and instrumental observations. "
            "Absence of evidence from video or sensors does not constitute proof that an event did not occur. "
            "Analysis remains strictly objective without declaring witness truthfulness or culpability."
        ),
        description="Legal and forensic disclaimer",
    )
    analyzed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}
