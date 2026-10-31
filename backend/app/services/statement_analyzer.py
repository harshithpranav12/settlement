"""Witness statement analysis service powered by Featherless AI.

Extracts structured claims, cross-examines accounts for conflicts,
generates targeted evidence requests, and ensures no hallucination
or premature truth determination.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.database import (
    create_analysis_run,
    create_contradiction,
    create_evidence_request,
    create_event,
    get_incident,
    list_parties_for_incident,
)
from app.models.analysis_run import AnalysisRunCreate, AnalysisRunStatus
from app.models.contradiction import ContradictionCreate, ContradictionSeverity, ContradictionStatus
from app.models.enums import EventClassification, EvidenceRequestStatus, PartyLabel
from app.models.event import ExtractedEventCreate
from app.models.evidence_request import EvidenceRequestCreate
from app.models.party import PartyResponse
from app.models.statement_analysis import (
    ClaimConflict,
    CompatibleClaim,
    ExtractedClaim,
    GeneratedEvidenceRequest,
    StatementAnalysisLLMOutput,
    StatementAnalysisResponse,
    UnresolvedQuestion,
)

logger = logging.getLogger("trace_ai.statement_analyzer")

SYSTEM_PROMPT = """You are an expert accident reconstruction forensic analyst.
Your objective is to compare and analyze two involved parties' statements (V1 and V2) from a road accident incident.

CRITICAL FORENSIC RULES:
1. NEVER invent, hallucinate, or extrapolate facts, timestamps, speeds, traffic signals, vehicle paths, or evidence that are not explicitly stated in the witnesses' words.
2. NEVER label a statement as "true" or "false". An LLM cannot determine liability or objective truth. Treat all driver assertions strictly as subjective "claims".
3. For every extracted claim, you MUST provide an exact, verbatim excerpt ("original_quote") copied directly from the party's statement.
4. If a timestamp, speed, distance, or sequence is omitted by the witness, mark it as unknown.
5. Identify:
   - "claims": Structured factual assertions made by each party.
   - "conflicts": Direct disagreements between V1 and V2 (e.g. traffic light signal color, vehicle speed, right-of-way, point of impact).
   - "compatible_claims": Points on which both parties agree (e.g. weather conditions, intersection location, incident occurrence).
   - "unresolved_questions": Open investigative ambiguities that require follow-up witness questions.
   - "evidence_requests": Actionable objective evidence that could potentially verify or refute identified conflicts (e.g. CCTV footage, traffic light timing logs, telematics).
   - "conclusion_status": Neutral forensic status (e.g. "conflicts_identified_pending_evidence", "compatible_accounts_pending_physical_evidence", "insufficient_statement_detail").

Respond ONLY with valid JSON matching this schema:
{
  "claims": [
    {
      "claim_id": "claim_v1_1",
      "party_label": "V1",
      "party_name": "...",
      "category": "traffic_signal|speed|lane_position|point_of_impact|evasive_action|other",
      "claim_text": "...",
      "original_quote": "...",
      "temporal_context": "..." or null
    }
  ],
  "conflicts": [
    {
      "conflict_id": "conflict_1",
      "topic": "...",
      "v1_claim_id": "claim_v1_1",
      "v2_claim_id": "claim_v2_1",
      "v1_quote": "...",
      "v2_quote": "...",
      "conflict_nature": "...",
      "severity": "minor|moderate|critical",
      "resolvable_by_evidence": true,
      "recommended_evidence_type": "cctv_footage"
    }
  ],
  "compatible_claims": [
    {
      "topic": "...",
      "summary": "...",
      "v1_quote": "...",
      "v2_quote": "..."
    }
  ],
  "unresolved_questions": [
    {
      "question_id": "q_1",
      "topic": "...",
      "question": "...",
      "party_affected": "V1" or "V2" or null,
      "reason": "..."
    }
  ],
  "evidence_requests": [
    {
      "request_type": "cctv_footage",
      "description": "...",
      "target_party": "City Traffic Dept",
      "rationale": "..."
    }
  ],
  "conclusion_status": "conflicts_identified_pending_evidence"
}"""


def _clean_json_response(raw_text: str) -> str:
    """Extract clean JSON substring from potential markdown code blocks."""
    raw_text = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_text)
    if match:
        return match.group(1).strip()
    return raw_text


def _generate_mock_analysis(
    v1: PartyResponse, v2: PartyResponse
) -> StatementAnalysisLLMOutput:
    """Generate a deterministic forensic analysis from real statements for mock mode."""
    v1_stmt = (v1.statement or "").strip()
    v2_stmt = (v2.statement or "").strip()

    # Extract verbatim quotes from the actual statements
    v1_quote = v1_stmt if len(v1_stmt) <= 120 else v1_stmt[:120] + "..."
    v2_quote = v2_stmt if len(v2_stmt) <= 120 else v2_stmt[:120] + "..."

    claims = [
        ExtractedClaim(
            claim_id="claim_v1_1",
            party_label=PartyLabel.V1,
            party_name=v1.name,
            category="traffic_signal",
            claim_text=f"Party V1 asserts their path was lawful: '{v1_quote}'",
            original_quote=v1_quote,
            temporal_context="Prior to impact",
        ),
        ExtractedClaim(
            claim_id="claim_v2_1",
            party_label=PartyLabel.V2,
            party_name=v2.name,
            category="traffic_signal",
            claim_text=f"Party V2 asserts their path was lawful: '{v2_quote}'",
            original_quote=v2_quote,
            temporal_context="Prior to impact",
        ),
    ]

    conflicts = [
        ClaimConflict(
            conflict_id="conflict_1",
            topic="Right-of-Way and Signal Discrepancy",
            v1_claim_id="claim_v1_1",
            v2_claim_id="claim_v2_1",
            v1_quote=v1_quote,
            v2_quote=v2_quote,
            conflict_nature="V1 and V2 provide conflicting accounts regarding right-of-way and situational awareness upon entering the collision zone.",
            severity=ContradictionSeverity.CRITICAL,
            resolvable_by_evidence=True,
            recommended_evidence_type="cctv_footage",
        )
    ]

    compatible = [
        CompatibleClaim(
            topic="Incident Occurrence",
            summary="Both parties confirm their participation in the intersection collision.",
            v1_quote=v1_quote,
            v2_quote=v2_quote,
        )
    ]

    questions = [
        UnresolvedQuestion(
            question_id="q_1",
            topic="Precise Impact Point",
            question="What was the exact velocity and steering angle of each vehicle 2 seconds prior to collision?",
            party_affected=None,
            reason="Neither party statement includes calibrated speed telematics.",
        )
    ]

    evidence_reqs = [
        GeneratedEvidenceRequest(
            request_type="cctv_footage",
            description="Obtain municipal or commercial CCTV coverage of the intersection to verify vehicle positions and traffic signals.",
            target_party="Municipal Traffic Department",
            rationale="Resolve conflict between V1 and V2 accounts regarding intersection entry and signal phases.",
        )
    ]

    return StatementAnalysisLLMOutput(
        claims=claims,
        conflicts=conflicts,
        compatible_claims=compatible,
        unresolved_questions=questions,
        evidence_requests=evidence_reqs,
        conclusion_status="conflicts_identified_pending_evidence",
    )


class StatementAnalyzerService:
    """Service orchestrating Featherless-powered statement analysis with persistence."""

    @property
    def api_key(self) -> Optional[str]:
        return settings.FEATHERLESS_API_KEY

    @property
    def base_url(self) -> str:
        return settings.FEATHERLESS_BASE_URL.rstrip("/")

    @property
    def model(self) -> str:
        return settings.FEATHERLESS_MODEL

    @property
    def timeout(self) -> float:
        return settings.FEATHERLESS_TIMEOUT_SECONDS

    @property
    def mock_mode(self) -> bool:
        return settings.FEATHERLESS_MOCK_MODE

    async def _call_featherless_api(
        self, v1: PartyResponse, v2: PartyResponse
    ) -> StatementAnalysisLLMOutput:
        """Execute chat completion request to Featherless AI."""
        if not self.api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Featherless AI service is not configured. "
                    "Please set FEATHERLESS_API_KEY in backend/.env, "
                    "or enable FEATHERLESS_MOCK_MODE=True in backend/.env for offline testing."
                ),
            )

        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        user_content = (
            f"Analyze the following two driver statements for road accident investigation:\n\n"
            f"--- PARTY V1 ---\n"
            f"Name: {v1.name}\n"
            f"Vehicle Registration: {v1.vehicle_registration}\n"
            f"Statement: \"{v1.statement}\"\n\n"
            f"--- PARTY V2 ---\n"
            f"Name: {v2.name}\n"
            f"Vehicle Registration: {v2.vehicle_registration}\n"
            f"Statement: \"{v2.statement}\"\n\n"
            f"Extract all claims with verbatim quotes, identify conflicts, compatible claims, "
            f"unresolved questions, and actionable evidence requests. Respond strictly with JSON."
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }

        logger.info("Calling Featherless API model=%s endpoint=%s", self.model, endpoint)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(endpoint, headers=headers, json=payload)
        except httpx.TimeoutException as exc:
            logger.error("Featherless API request timed out after %.1fs", self.timeout)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=f"Featherless AI service timed out after {self.timeout}s. Please retry.",
            ) from exc
        except httpx.RequestError as exc:
            logger.error("Featherless API connection error: %s", str(exc))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to connect to Featherless AI provider at {self.base_url}: {str(exc)}",
            ) from exc

        if response.status_code == 401 or response.status_code == 403:
            logger.error("Featherless authentication failure: %s", response.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Featherless AI authentication failed. Please verify your FEATHERLESS_API_KEY.",
            )

        if response.status_code == 429:
            logger.warning("Featherless rate limit exceeded: %s", response.text)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Featherless AI rate limit reached. Please retry after a brief pause.",
            )

        if response.is_error:
            logger.error(
                "Featherless provider error status=%d body=%s",
                response.status_code,
                response.text,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Featherless AI returned status {response.status_code}: {response.text[:200]}",
            )

        try:
            data = response.json()
            message_content = data["choices"][0]["message"]["content"]
            cleaned_json = _clean_json_response(message_content)
            parsed_data = json.loads(cleaned_json)
            return StatementAnalysisLLMOutput.model_validate(parsed_data)
        except (KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
            logger.error(
                "Failed to parse LLM structured output. Raw response: %s",
                response.text[:500],
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The AI provider returned an invalid or non-JSON output format.",
            ) from exc

    async def analyze_incident_statements(
        self, incident_id: str
    ) -> StatementAnalysisResponse:
        """Main service pipeline: load parties, analyze statements, persist results."""
        # 1. Load incident
        incident = get_incident(incident_id)
        if not incident:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident with ID '{incident_id}' not found.",
            )

        # 2. Load parties and validate V1 and V2 statements
        parties = list_parties_for_incident(incident_id)
        v1_party: Optional[PartyResponse] = next(
            (p for p in parties if p.party_label == PartyLabel.V1), None
        )
        v2_party: Optional[PartyResponse] = next(
            (p for p in parties if p.party_label == PartyLabel.V2), None
        )

        if not v1_party or not v2_party:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Comparative statement analysis requires both party V1 and party V2. "
                    f"Found registered parties: {[p.party_label.value for p in parties]}."
                ),
            )

        if not (v1_party.statement and v1_party.statement.strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Party V1 ({v1_party.name}) has no recorded statement to analyze.",
            )

        if not (v2_party.statement and v2_party.statement.strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Party V2 ({v2_party.name}) has no recorded statement to analyze.",
            )

        # 3. Analyze via Mock or Featherless API
        is_mock = False
        if self.mock_mode:
            logger.info("Executing statement analysis in configured MOCK MODE for incident %s", incident_id)
            llm_output = _generate_mock_analysis(v1_party, v2_party)
            is_mock = True
        else:
            llm_output = await self._call_featherless_api(v1_party, v2_party)

        # 4. Save analysis results to database
        analysis_id = str(uuid4())
        created_at = datetime.now(timezone.utc)

        # 4a. Persist extracted claims into extracted_events table
        claim_to_event_id: Dict[str, str] = {}
        for claim in llm_output.claims:
            party_ref = v1_party if claim.party_label == PartyLabel.V1 else v2_party
            event = create_event(
                ExtractedEventCreate(
                    incident_id=incident_id,
                    source_id=party_ref.id,
                    event_type=claim.category,
                    description=claim.claim_text,
                    classification=EventClassification.CLAIM,
                    wall_clock_timestamp=None,  # Never invent timestamps
                    video_offset_seconds=None,
                    evidence_references=[],
                    metadata={
                        "claim_id": claim.claim_id,
                        "party_label": claim.party_label.value,
                        "original_quote": claim.original_quote,
                        "temporal_context": claim.temporal_context,
                        "analysis_id": analysis_id,
                    },
                )
            )
            claim_to_event_id[claim.claim_id] = event.id

        # 4b. Persist conflicts into contradictions table
        for conflict in llm_output.conflicts:
            event_a = claim_to_event_id.get(conflict.v1_claim_id) if conflict.v1_claim_id else None
            event_b = claim_to_event_id.get(conflict.v2_claim_id) if conflict.v2_claim_id else None
            create_contradiction(
                ContradictionCreate(
                    incident_id=incident_id,
                    title=conflict.topic,
                    description=conflict.conflict_nature,
                    event_id_a=event_a,
                    event_id_b=event_b,
                    severity=conflict.severity,
                    status=ContradictionStatus.DETECTED,
                )
            )

        # 4c. Persist generated evidence requests into evidence_requests table
        for req in llm_output.evidence_requests:
            create_evidence_request(
                EvidenceRequestCreate(
                    incident_id=incident_id,
                    request_type=req.request_type,
                    description=req.description,
                    target_party=req.target_party,
                    status=EvidenceRequestStatus.PENDING,
                )
            )

        # 4d. Persist analysis run history into analysis_runs table
        create_analysis_run(
            AnalysisRunCreate(
                incident_id=incident_id,
                run_type="statement_analysis",
                status=AnalysisRunStatus.COMPLETED,
                summary=(
                    f"Analyzed statements of {v1_party.name} (V1) and {v2_party.name} (V2). "
                    f"Extracted {len(llm_output.claims)} claims, identified {len(llm_output.conflicts)} conflicts, "
                    f"and generated {len(llm_output.evidence_requests)} evidence requests."
                ),
                findings={
                    "analysis_id": analysis_id,
                    "conclusion_status": llm_output.conclusion_status,
                    "claims_count": len(llm_output.claims),
                    "conflicts_count": len(llm_output.conflicts),
                    "compatible_count": len(llm_output.compatible_claims),
                    "unresolved_questions_count": len(llm_output.unresolved_questions),
                    "evidence_requests_count": len(llm_output.evidence_requests),
                    "is_mock": is_mock,
                },
            )
        )

        return StatementAnalysisResponse(
            analysis_id=analysis_id,
            incident_id=incident_id,
            claims=llm_output.claims,
            conflicts=llm_output.conflicts,
            compatible_claims=llm_output.compatible_claims,
            unresolved_questions=llm_output.unresolved_questions,
            evidence_requests=llm_output.evidence_requests,
            conclusion_status=llm_output.conclusion_status,
            is_mock=is_mock,
            created_at=created_at,
        )


statement_analyzer_service = StatementAnalyzerService()
