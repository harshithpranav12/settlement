"""Forensic investigation workflow orchestration engine for TRACE AI.

Coordinates the end-to-end analytical pipeline:
1. Loads incident, parties, and submitted evidence.
2. Evaluates state: awaiting_initial_statements, awaiting_evidence, processing, ready_for_review, or failed.
3. Synthesizes timeline and cross-examines contradictions across claims, vision, and sensor data.
4. Generates targeted, evidence-driven requests to resolve open questions without endless loops.
5. Saves analytical run history without mutating or overwriting prior runs.
"""

from datetime import datetime, timezone
import logging
import time
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status

from app.database import (
    create_analysis_run,
    create_evidence_request,
    get_incident,
    list_analysis_runs_for_incident,
    list_evidence_for_incident,
    list_evidence_requests_for_incident,
    list_events_for_incident,
    list_parties_for_incident,
    update_analysis_run,
)
from app.models.analysis_run import AnalysisRunCreate, AnalysisRunStatus, AnalysisRunUpdate
from app.models.enums import (
    EvidenceRequestStatus,
    EvidenceType,
    InvestigationStatus,
    PartyLabel,
)
from app.models.evidence_request import EvidenceRequestCreate, EvidenceRequestResponse
from app.models.investigation import InvestigationWorkflowResponse
from app.models.timeline import TimelineSyncRequest
from app.services.contradiction_engine import contradiction_engine_service
from app.services.timeline_engine import timeline_engine_service

logger = logging.getLogger("trace_ai.investigation_engine")


class InvestigationEngineService:
    """Coordinates multi-modal investigation pipelines and evidence-driven workflows."""

    async def run_investigation(self, incident_id: str) -> InvestigationWorkflowResponse:
        """Execute or update the automated investigation workflow for an incident."""
        start_time = time.perf_counter()
        started_at = datetime.now(timezone.utc)

        incident = get_incident(incident_id)
        if not incident:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident with ID '{incident_id}' not found.",
            )

        # Count prior runs to track run_count
        prior_runs = list_analysis_runs_for_incident(incident_id)
        run_count = len(prior_runs) + 1

        run = create_analysis_run(
            AnalysisRunCreate(
                incident_id=incident_id,
                run_type="investigation_workflow",
                status=AnalysisRunStatus.RUNNING,
                summary=f"Automated investigation run #{run_count} for {incident.title}",
            )
        )

        try:
            # 1. Inspect parties and recorded statements
            parties = list_parties_for_incident(incident_id)
            parties_by_label = {p.party_label: p for p in parties}
            has_v1 = PartyLabel.V1 in parties_by_label and bool((parties_by_label[PartyLabel.V1].statement or "").strip())
            has_v2 = PartyLabel.V2 in parties_by_label and bool((parties_by_label[PartyLabel.V2].statement or "").strip())

            parties_summary = {
                "total_parties": len(parties),
                "has_v1_statement": has_v1,
                "has_v2_statement": has_v2,
                "parties": [
                    {
                        "party_id": p.id,
                        "label": p.party_label.value,
                        "name": p.name,
                        "statement_length": len(p.statement or ""),
                    }
                    for p in parties
                ],
            }

            # State check: Awaiting initial statements
            if not has_v1 or not has_v2:
                duration_ms = (time.perf_counter() - start_time) * 1000.0
                completed_at = datetime.now(timezone.utc)

                update_analysis_run(
                    run.id,
                    AnalysisRunUpdate(
                        status=AnalysisRunStatus.COMPLETED,
                        completed_at=completed_at,
                        summary="Awaiting statements from both party V1 and party V2",
                    ),
                )

                missing_who = []
                if not has_v1:
                    missing_who.append("Party V1")
                if not has_v2:
                    missing_who.append("Party V2")

                return InvestigationWorkflowResponse(
                    incident_id=incident_id,
                    incident_title=incident.title,
                    status=InvestigationStatus.AWAITING_INITIAL_STATEMENTS,
                    started_at=started_at,
                    completed_at=completed_at,
                    execution_duration_ms=duration_ms,
                    run_count=run_count,
                    parties_summary=parties_summary,
                    evidence_summary={"total_items": 0},
                    timeline_summary={"total_events": 0},
                    contradictions_summary={"total_conflicts": 0},
                    evidence_requests=[],
                    new_evidence_requests_created=0,
                    unresolved_questions=[
                        {
                            "topic": "Initial Driver Statements",
                            "question": f"Record formal witness statements for {', '.join(missing_who)}.",
                        }
                    ],
                    is_conclusive=False,
                    conclusion_summary=f"Investigation pending: Missing initial statements from {', '.join(missing_who)}.",
                )

            # Auto-trigger statement analysis if V1 and V2 statements are available and not yet analyzed
            existing_statement_runs = [r for r in list_analysis_runs_for_incident(incident_id) if r.run_type == "statement_analysis"]
            if not existing_statement_runs:
                try:
                    from app.services.statement_analyzer import statement_analyzer_service
                    await statement_analyzer_service.analyze_incident_statements(incident_id)
                except Exception as exc:
                    logger.warning("Auto-trigger of statement analysis skipped or failed: %s", exc)

            # 2. Inspect available evidence
            evidence_items = list_evidence_for_incident(incident_id)
            evidence_by_type: Dict[str, int] = {}
            for e in evidence_items:
                evidence_by_type[e.evidence_type.value] = evidence_by_type.get(e.evidence_type.value, 0) + 1

            has_physical_evidence = any(
                e.evidence_type in {EvidenceType.DASHCAM_VIDEO, EvidenceType.CCTV_VIDEO, EvidenceType.TELEMATICS, EvidenceType.GPS_LOG}
                for e in evidence_items
            )

            evidence_summary = {
                "total_items": len(evidence_items),
                "breakdown": evidence_by_type,
                "has_physical_telematics_or_video": has_physical_evidence,
            }

            # 3. Build Timeline
            timeline = timeline_engine_service.build_timeline(
                incident_id=incident_id,
                sync_request=TimelineSyncRequest(group_occurrences=True),
            )
            timeline_summary = {
                "total_events": timeline.total_events,
                "occurrences_clustered": len(timeline.occurrences),
                "video_tracks": len(timeline.video_tracks),
                "synchronized": timeline.synchronized,
                "applied_sync_offsets": timeline.applied_sync_offsets,
            }

            # 4. Cross-examine contradictions
            contradictions = contradiction_engine_service.analyze_contradictions(incident_id=incident_id)
            contradictions_summary = {
                "total_contradictions": contradictions.total_contradictions,
                "compatible_statements": len(contradictions.compatible_statements),
                "unresolved_conflicts": contradictions.unresolved_count,
                "missing_evidence_items": len(contradictions.missing_evidence_items),
            }

            # 5. Retrieve existing evidence requests and create new ones for missing evidence
            existing_requests = list_evidence_requests_for_incident(incident_id)
            existing_req_types = {r.request_type.lower() for r in existing_requests}

            new_requests_created = 0
            for missing_item in contradictions.missing_evidence_items:
                req_type = (missing_item.suggested_evidence or "cctv_video").lower()
                # Deduplicate: do not create duplicate active requests
                if req_type not in existing_req_types:
                    created_req = create_evidence_request(
                        incident_id=incident_id,
                        data=EvidenceRequestCreate(
                            request_type=req_type,
                            description=missing_item.camera_coverage_note,
                            target_party=missing_item.topic,
                            status=EvidenceRequestStatus.PENDING,
                        ),
                    )
                    existing_requests.append(created_req)
                    existing_req_types.add(req_type)
                    new_requests_created += 1

            # 6. Determine final status
            is_conclusive = (
                contradictions.total_contradictions == 0
                and len(contradictions.missing_evidence_items) == 0
                and has_physical_evidence
            )

            if not has_physical_evidence:
                workflow_status = InvestigationStatus.AWAITING_EVIDENCE
                conclusion_summary = (
                    "Initial statements processed and conflicts identified. "
                    "Awaiting physical telemetry or video evidence to verify conflicting claims."
                )
            else:
                workflow_status = InvestigationStatus.READY_FOR_REVIEW
                conclusion_summary = (
                    "Investigation analysis complete and ready for human forensic review. "
                    + (
                        "All material claims have been reconciled against available evidence."
                        if is_conclusive
                        else f"{contradictions.total_contradictions} factual contradiction(s) remain open."
                    )
                )

            duration_ms = (time.perf_counter() - start_time) * 1000.0
            completed_at = datetime.now(timezone.utc)

            update_analysis_run(
                run.id,
                AnalysisRunUpdate(
                    status=AnalysisRunStatus.COMPLETED,
                    completed_at=completed_at,
                    summary=conclusion_summary,
                    findings={
                        "is_conclusive": is_conclusive,
                        "status": workflow_status.value,
                        "timeline_count": timeline.total_events,
                        "contradictions_count": contradictions.total_contradictions,
                        "new_evidence_requests": new_requests_created,
                    },
                ),
            )

            return InvestigationWorkflowResponse(
                incident_id=incident_id,
                incident_title=incident.title,
                status=workflow_status,
                started_at=started_at,
                completed_at=completed_at,
                execution_duration_ms=duration_ms,
                run_count=run_count,
                parties_summary=parties_summary,
                evidence_summary=evidence_summary,
                timeline_summary=timeline_summary,
                contradictions_summary=contradictions_summary,
                evidence_requests=existing_requests,
                new_evidence_requests_created=new_requests_created,
                unresolved_questions=[
                    f.model_dump(mode="json")
                    for f in contradictions.findings
                    if f.status.value in ("detected", "under_review", "unresolved")
                ],
                is_conclusive=is_conclusive,
                conclusion_summary=conclusion_summary,
            )

        except Exception as exc:
            logger.error("Investigation workflow failed for %s: %s", incident_id, str(exc), exc_info=True)
            update_analysis_run(
                run.id,
                AnalysisRunUpdate(
                    status=AnalysisRunStatus.FAILED,
                    completed_at=datetime.now(timezone.utc),
                    error_message=str(exc),
                ),
            )
            raise


investigation_engine_service = InvestigationEngineService()
