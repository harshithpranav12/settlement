"""Pydantic schemas for the automated forensic investigation workflow coordination."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import InvestigationStatus
from app.models.evidence_request import EvidenceRequestResponse


class InvestigationWorkflowResponse(BaseModel):
    """Comprehensive investigation run status and analytical synthesis."""

    investigation_id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    incident_title: str
    status: InvestigationStatus = Field(
        ...,
        description="Overall investigation state: awaiting_initial_statements, awaiting_evidence, processing, ready_for_review, failed",
        examples=[InvestigationStatus.READY_FOR_REVIEW],
    )
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    execution_duration_ms: Optional[float] = None
    run_count: int = Field(default=1, description="Sequential index of this analytical run for the incident")

    # Modality summaries
    parties_summary: Dict[str, Any] = Field(default_factory=dict)
    evidence_summary: Dict[str, Any] = Field(default_factory=dict)
    timeline_summary: Dict[str, Any] = Field(default_factory=dict)
    contradictions_summary: Dict[str, Any] = Field(default_factory=dict)

    # Evidence-driven requests
    evidence_requests: List[EvidenceRequestResponse] = Field(
        default_factory=list,
        description="Evidence-driven requests generated for unresolved conflicts",
    )
    new_evidence_requests_created: int = Field(default=0)
    unresolved_questions: List[Dict[str, Any]] = Field(default_factory=list)

    # Forensic conclusions
    is_conclusive: bool = Field(
        default=False,
        description="True if all material contradictions have been objectively verified; False if inconclusive",
    )
    conclusion_summary: str = Field(
        ...,
        description="Objective status summary of the case findings",
    )
    disclaimer: str = Field(
        default=(
            "TRACE AI provides evidence-based timeline reconstruction and factual contradiction identification. "
            "It does not determine legal fault, criminal culpability, or financial liability."
        ),
        description="Forensic and legal disclaimer",
    )
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}
