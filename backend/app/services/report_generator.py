"""Investigation report generation service for TRACE AI.

Assembles stored timeline reconstructions, contradiction analyses, video detections,
and sensor telemetry into a 10-section structured forensic report.
Distinguishes observations, claims, and inferences, includes evidence IDs,
never asserts legal liability, and uses Featherless only to summarize validated facts.
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.database import (
    create_analysis_run,
    get_incident,
    get_latest_report_for_incident,
    list_evidence_for_incident,
    list_events_for_incident,
    list_parties_for_incident,
    save_report,
    update_analysis_run,
)
from app.models.analysis_run import AnalysisRunCreate, AnalysisRunStatus, AnalysisRunUpdate
from app.models.enums import EventClassification, PartyLabel
from app.models.report import (
    EvidenceFindingRef,
    InvestigationReportResponse,
    PartyStatementRecord,
    SensorObservationRef,
    VideoObservationRef,
)
from app.models.timeline import TimelineSyncRequest
from app.services.contradiction_engine import contradiction_engine_service
from app.services.timeline_engine import timeline_engine_service

logger = logging.getLogger("trace_ai.report_generator")

STANDARD_EVIDENCE_LIMITATIONS: List[str] = [
    "Absence from Video: Non-detection of an action or vehicle in video frames does not prove non-occurrence due to camera field-of-view limits and occlusion.",
    "Spatial Coordinate Mapping: Object bounding boxes and trajectories are represented in 2D image pixel space and cannot be treated as surveyed metric geographic coordinates without photogrammetric calibration.",
    "Temporal Synchronization: Video frame offsets are relative to recording start; alignment with sensor telemetry UTC clocks requires explicit time synchronization.",
    "Epistemic Distinction: Driver and witness statements are classified strictly as subjective claims and are not accepted as established fact without physical corroboration.",
    "Model Confidence Metrics: Object detection and extraction confidence scores represent algorithmic heuristics and must not be interpreted as calibrated Bayesian probabilities.",
    "Non-Determination of Liability: TRACE AI performs objective technical event sequencing and does not assign legal fault, civil negligence, or financial liability.",
]


class ReportGeneratorService:
    """Orchestrates structured investigation report assembly and persistence."""

    def _generate_deterministic_summary(
        self,
        incident_title: str,
        parties: List[PartyStatementRecord],
        timeline_count: int,
        contradiction_count: int,
        unresolved_count: int,
        is_conclusive: bool,
    ) -> str:
        """Create an evidence-grounded summary without external LLM dependencies."""
        party_str = " and ".join(
            f"{p.name} ({p.party_label}, vehicle {p.vehicle_registration})"
            for p in parties
        )
        if not parties:
            party_str = "involved parties (records pending)"

        status_text = (
            "all material discrepancies have been objectively reconciled by sensor and video evidence."
            if is_conclusive
            else f"{contradiction_count} factual contradiction(s) and {unresolved_count} investigative question(s) remain unresolved pending further evidence."
        )

        return (
            f"Investigation summary for '{incident_title}': Involving {party_str}. "
            f"A multi-modal chronological reconstruction established {timeline_count} validated timeline event(s). "
            f"Cross-examination of party statements against telemetry and vision evidence revealed that {status_text} "
            f"This summary is strictly limited to verified physical data and verbatim witness assertions without attribution of legal liability."
        )

    async def _call_featherless_summary(
        self,
        incident_title: str,
        parties: List[PartyStatementRecord],
        findings_payload: Dict[str, Any],
    ) -> Optional[str]:
        """Optional Featherless call to synthesize verified evidence into a concise summary."""
        if not settings.FEATHERLESS_API_KEY or settings.FEATHERLESS_MOCK_MODE:
            return None

        endpoint = f"{settings.FEATHERLESS_BASE_URL.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.FEATHERLESS_API_KEY}",
            "Content-Type": "application/json",
        }

        system_prompt = (
            "You are an objective forensic investigation report summarizer. "
            "Write a concise, 2-3 paragraph evidence-grounded executive summary of the provided incident. "
            "STRICT RULES: "
            "1. Only mention facts provided in the input; NEVER invent speeds, timestamps, or findings. "
            "2. Distinguish witness claims from verified sensor/video observations. "
            "3. If evidence is inconclusive or contradictions remain, explicitly state that. "
            "4. NEVER declare any party at fault, liable, or guilty. "
            "5. Respond with plain text."
        )

        user_content = (
            f"Incident: {incident_title}\n"
            f"Parties: {[{'label': p.party_label.value, 'name': p.name, 'statement': p.statement} for p in parties]}\n"
            f"Findings: {json.dumps(findings_payload, default=str)[:3000]}\n"
        )

        try:
            async with httpx.AsyncClient(timeout=min(settings.FEATHERLESS_TIMEOUT_SECONDS, 20.0)) as client:
                resp = await client.post(
                    endpoint,
                    headers=headers,
                    json={
                        "model": settings.FEATHERLESS_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_content},
                        ],
                        "temperature": 0.2,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    summary_text = data["choices"][0]["message"]["content"].strip()
                    if summary_text:
                        return summary_text
        except Exception as exc:
            logger.warning("Featherless summary generation bypassed or failed: %s", str(exc))

        return None

    async def generate_report(
        self,
        incident_id: str,
        analysis_run_id: Optional[str] = None,
    ) -> InvestigationReportResponse:
        """Generate a complete 10-section investigation report and persist it."""
        incident = get_incident(incident_id)
        if not incident:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident with ID '{incident_id}' not found.",
            )

        # 1. Initialize analysis run record
        run = create_analysis_run(
            AnalysisRunCreate(
                incident_id=incident_id,
                run_type="investigation_report",
                status=AnalysisRunStatus.RUNNING,
                summary=f"Generating investigation report for {incident.title}",
            )
        )

        try:
            # 2. Collect Parties and Statements
            raw_parties = list_parties_for_incident(incident_id)
            parties: List[PartyStatementRecord] = [
                PartyStatementRecord(
                    party_label=p.party_label,
                    name=p.name,
                    vehicle_registration=p.vehicle_registration,
                    statement=p.statement,
                )
                for p in raw_parties
            ]

            # 3. Build Timeline
            timeline_response = timeline_engine_service.build_timeline(
                incident_id=incident_id,
                sync_request=TimelineSyncRequest(group_occurrences=True),
            )

            # 4. Analyze Contradictions & Missing Evidence
            contradiction_response = contradiction_engine_service.analyze_contradictions(
                incident_id=incident_id
            )

            # 5. Extract Video Observations
            all_events = list_events_for_incident(incident_id)
            video_observations: List[VideoObservationRef] = []
            for ev in all_events:
                if ev.classification == EventClassification.OBSERVATION and (
                    ev.video_offset_seconds is not None or "frame_number" in ev.metadata or "bbox" in ev.metadata
                ):
                    meta = ev.metadata or {}
                    video_observations.append(
                        VideoObservationRef(
                            source_id=ev.source_id or "unspecified_video",
                            frame_number=meta.get("frame_number"),
                            timestamp_seconds=ev.video_offset_seconds,
                            vehicle_id=meta.get("vehicle_id") or meta.get("track_id") or "TRACK_UNKNOWN",
                            detected_class=meta.get("class", "vehicle"),
                            bbox=meta.get("bbox"),
                            confidence=ev.confidence,
                            description=ev.description,
                        )
                    )

            # 6. Extract Sensor Observations
            sensor_observations: List[SensorObservationRef] = []
            for ev in all_events:
                meta = ev.metadata or {}
                if ev.classification == EventClassification.OBSERVATION and (
                    "row_index" in meta
                    or "row_start" in meta
                    or "source_filename" in meta
                    or "sensor" in ev.event_type.lower()
                    or "deceleration" in ev.event_type.lower()
                    or "stopped" in ev.event_type.lower()
                    or "speed_kmh" in meta
                ):
                    sensor_observations.append(
                        SensorObservationRef(
                            evidence_id=ev.source_id or "sensor_source",
                            source_filename=meta.get("source_filename", "sensor_data.csv"),
                            row_number=meta.get("row_start", meta.get("row_index", 0)),
                            timestamp=ev.wall_clock_timestamp.isoformat() if ev.wall_clock_timestamp else None,
                            relative_seconds=ev.video_offset_seconds,
                            speed_kmh=meta.get("speed_kmh", meta.get("final_speed_kmh")),
                            event_type=ev.event_type,
                            description=ev.description,
                        )
                    )

            # 7. Formulate Evidence Supporting Findings
            evidence_support: List[EvidenceFindingRef] = []
            for ev in all_events:
                refs = ev.evidence_references or []
                if ev.source_id and ev.source_id not in refs:
                    refs = [ev.source_id] + refs

                conf_desc = (
                    f"Direct physical observation with {ev.confidence:.2f} extraction confidence"
                    if ev.classification == EventClassification.OBSERVATION and ev.confidence is not None
                    else f"Direct physical observation recorded in source evidence {refs}"
                    if ev.classification == EventClassification.OBSERVATION
                    else f"Subjective statement claim from party {ev.source_id}"
                    if ev.classification == EventClassification.CLAIM
                    else f"Correlated finding derived from {len(refs)} evidence source(s)"
                )

                evidence_support.append(
                    EvidenceFindingRef(
                        finding_id=ev.id,
                        description=ev.description,
                        classification=ev.classification,
                        supporting_evidence_ids=refs,
                        confidence_assessment=conf_desc,
                    )
                )

            # 8. Determine Open Questions
            is_conclusive = (
                contradiction_response.total_contradictions == 0
                and len(contradiction_response.missing_evidence_items) == 0
            )

            # 9. Synthesize Executive Summary
            findings_summary_payload = {
                "timeline_items": len(timeline_response.chronological_timeline),
                "contradictions": contradiction_response.total_contradictions,
                "missing_evidence": len(contradiction_response.missing_evidence_items),
                "is_conclusive": is_conclusive,
            }

            llm_summary = await self._call_featherless_summary(
                incident_title=incident.title,
                parties=parties,
                findings_payload=findings_summary_payload,
            )

            unresolved_list = [
                f.model_dump(mode="json")
                for f in contradiction_response.findings
                if f.status.value in ("detected", "under_review", "unresolved")
            ]

            executive_summary = llm_summary or self._generate_deterministic_summary(
                incident_title=incident.title,
                parties=parties,
                timeline_count=len(timeline_response.chronological_timeline),
                contradiction_count=contradiction_response.total_contradictions,
                unresolved_count=contradiction_response.unresolved_count,
                is_conclusive=is_conclusive,
            )

            # 10. Assemble Response Object
            report_response = InvestigationReportResponse(
                incident_id=incident_id,
                analysis_run_id=run.id,
                incident_summary={
                    "id": incident.id,
                    "title": incident.title,
                    "location": incident.location,
                    "status": incident.status.value,
                    "created_at": incident.created_at.isoformat(),
                },
                parties=parties,
                timeline=timeline_response.chronological_timeline,
                video_observations=video_observations,
                sensor_observations=sensor_observations,
                conflicting_claims=contradiction_response.findings,
                evidence_support=evidence_support,
                unresolved_questions=unresolved_list,
                missing_evidence=contradiction_response.missing_evidence_items,
                evidence_limitations=STANDARD_EVIDENCE_LIMITATIONS,
                executive_summary=executive_summary,
            )

            # 11. Save Report Record in Database
            save_report(
                incident_id=incident_id,
                title=f"Investigation Report: {incident.title}",
                report_data=report_response.model_dump(mode="json"),
                report_id=report_response.report_id,
                analysis_run_id=run.id,
            )

            # 12. Mark Analysis Run as Completed
            update_analysis_run(
                run.id,
                AnalysisRunUpdate(
                    status=AnalysisRunStatus.COMPLETED,
                    completed_at=datetime.now(timezone.utc),
                    summary=f"Report generated successfully with {len(report_response.timeline)} timeline items",
                    findings={
                        "report_id": report_response.report_id,
                        "timeline_count": len(report_response.timeline),
                        "conflicts_count": len(report_response.conflicting_claims),
                        "is_conclusive": is_conclusive,
                    },
                ),
            )

            return report_response

        except Exception as exc:
            logger.error("Failed to generate investigation report for %s: %s", incident_id, str(exc), exc_info=True)
            update_analysis_run(
                run.id,
                AnalysisRunUpdate(
                    status=AnalysisRunStatus.FAILED,
                    completed_at=datetime.now(timezone.utc),
                    error_message=str(exc),
                ),
            )
            raise


report_generator_service = ReportGeneratorService()
