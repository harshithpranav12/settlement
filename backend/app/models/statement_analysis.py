"""Pydantic schemas for Featherless-powered witness statement analysis."""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import ContradictionSeverity, PartyLabel


class ExtractedClaim(BaseModel):
    """A factual claim asserted by a witness/party in their statement."""

    claim_id: str = Field(
        ...,
        description="Unique identifier for the claim within the analysis",
        examples=["claim_v1_1"],
    )
    party_label: PartyLabel = Field(
        ...,
        description="Originating party, strictly 'V1' or 'V2'",
        examples=[PartyLabel.V1],
    )
    party_name: str = Field(
        ...,
        description="Name of the party who asserted the claim",
        examples=["John Doe"],
    )
    category: str = Field(
        ...,
        description="Domain category (e.g. speed, traffic_signal, lane_position, point_of_impact, evasive_action)",
        examples=["traffic_signal"],
    )
    claim_text: str = Field(
        ...,
        description="Concise factual proposition asserted",
        examples=["Traffic light was green for V1 upon entering intersection."],
    )
    original_quote: str = Field(
        ...,
        description="Exact verbatim excerpt from the statement supporting this claim",
        examples=["The traffic light turned green so I proceeded."],
    )
    temporal_context: Optional[str] = Field(
        default=None,
        description="Temporal or sequence context if explicitly stated in text (never invented)",
        examples=["Entering intersection"],
    )


class ClaimConflict(BaseModel):
    """A direct discrepancy between claims from opposing parties."""

    conflict_id: str = Field(
        ...,
        description="Unique identifier for the conflict",
        examples=["conflict_1"],
    )
    topic: str = Field(
        ...,
        description="Subject of disagreement (e.g. 'Traffic Signal State')",
        examples=["Traffic Signal State"],
    )
    v1_claim_id: Optional[str] = Field(
        default=None,
        description="Reference to V1 claim if applicable",
    )
    v2_claim_id: Optional[str] = Field(
        default=None,
        description="Reference to V2 claim if applicable",
    )
    v1_quote: str = Field(
        ...,
        description="Relevant statement text from V1",
    )
    v2_quote: str = Field(
        ...,
        description="Relevant statement text from V2",
    )
    conflict_nature: str = Field(
        ...,
        description="Explanation of the contradiction",
        examples=["V1 claims their light was green, whereas V2 claims V1 ran a red light."],
    )
    severity: ContradictionSeverity = Field(
        default=ContradictionSeverity.MODERATE,
        description="Severity of impact on timeline and liability",
    )
    resolvable_by_evidence: bool = Field(
        default=True,
        description="Whether objective evidence could verify or refute this conflict",
    )
    recommended_evidence_type: Optional[str] = Field(
        default=None,
        description="Suggested evidence type to resolve this conflict",
        examples=["cctv_footage", "signal_phase_logs"],
    )


class CompatibleClaim(BaseModel):
    """Claims where both parties agree or assertions do not conflict."""

    topic: str = Field(
        ...,
        description="Subject of agreement",
        examples=["Weather Condition"],
    )
    summary: str = Field(
        ...,
        description="Summary of compatible understanding",
        examples=["Both drivers agree it was drizzling and road surface was damp."],
    )
    v1_quote: Optional[str] = Field(
        default=None,
        description="V1 corroborating text excerpt",
    )
    v2_quote: Optional[str] = Field(
        default=None,
        description="V2 corroborating text excerpt",
    )


class UnresolvedQuestion(BaseModel):
    """An open investigative question arising from ambiguous, uncorroborated, or missing statement details."""

    question_id: str = Field(
        ...,
        description="Unique identifier for the question",
        examples=["q_1"],
    )
    topic: str = Field(
        ...,
        description="Topic or area of ambiguity",
        examples=["Vehicle Speed"],
    )
    question: str = Field(
        ...,
        description="Investigative question that needs clarification",
        examples=["What was the exact speed of V2 prior to applying brakes?"],
    )
    party_affected: Optional[PartyLabel] = Field(
        default=None,
        description="Party whose testimony prompted this question",
    )
    reason: str = Field(
        ...,
        description="Why this question is critical to timeline reconstruction",
    )


class GeneratedEvidenceRequest(BaseModel):
    """Targeted evidence request generated to resolve a specific statement conflict."""

    request_type: str = Field(
        ...,
        description="Evidence category (e.g. 'cctv_footage', 'telematics_data', 'traffic_signal_timing_log')",
        examples=["cctv_footage"],
    )
    description: str = Field(
        ...,
        description="Detailed scope of the evidence request",
        examples=["Request municipal traffic camera footage for intersection between 14:15 and 14:25 UTC."],
    )
    target_party: Optional[str] = Field(
        default=None,
        description="Entity or repository to request evidence from",
        examples=["City Traffic Department"],
    )
    rationale: str = Field(
        ...,
        description="Specific conflict or question this evidence will clarify",
    )


class StatementAnalysisLLMOutput(BaseModel):
    """Schema representing the raw structured response expected from the LLM."""

    claims: List[ExtractedClaim] = Field(default_factory=list)
    conflicts: List[ClaimConflict] = Field(default_factory=list)
    compatible_claims: List[CompatibleClaim] = Field(default_factory=list)
    unresolved_questions: List[UnresolvedQuestion] = Field(default_factory=list)
    evidence_requests: List[GeneratedEvidenceRequest] = Field(default_factory=list)
    conclusion_status: str = Field(
        default="conflicts_identified_pending_evidence",
        description="Status: 'conflicts_identified_pending_evidence', 'compatible_accounts_pending_physical_evidence', or 'insufficient_statement_detail'",
    )


class StatementAnalysisResponse(BaseModel):
    """Structured response for witness statement analysis."""

    analysis_id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    claims: List[ExtractedClaim] = Field(default_factory=list)
    conflicts: List[ClaimConflict] = Field(default_factory=list)
    compatible_claims: List[CompatibleClaim] = Field(default_factory=list)
    unresolved_questions: List[UnresolvedQuestion] = Field(default_factory=list)
    evidence_requests: List[GeneratedEvidenceRequest] = Field(default_factory=list)
    conclusion_status: str = Field(
        default="conflicts_identified_pending_evidence",
        description="Forensic investigation status (never labels statements as objectively true)",
    )
    is_mock: bool = Field(
        default=False,
        description="Flag indicating if analysis was produced by configured mock mode",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}
