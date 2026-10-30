"""Forensic contradiction engine for TRACE AI.

Identifies factual incompatibilities, conflicting event sequences, and divergences
between witness claims, video detections, and sensor telematics.
Distinguishes direct contradictions from missing evidence and wording differences.
Adheres strictly to objective forensic standards: never labels witnesses truthful
or deceptive, preserves unresolved contradictions when evidence is insufficient,
and never assumes absence from video proves non-occurrence.
"""

from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

from fastapi import HTTPException, status

from app.database import (
    create_analysis_run,
    create_contradiction,
    get_incident,
    list_contradictions_for_incident,
    list_events_for_incident,
    list_parties_for_incident,
)
from app.models.analysis_run import AnalysisRunCreate, AnalysisRunStatus
from app.models.contradiction import ContradictionCreate
from app.models.contradiction_engine import (
    CompatibleStatementItem,
    ConflictType,
    ContradictionEngineResponse,
    ContradictionFinding,
    MissingEvidenceItem,
)
from app.models.enums import (
    ContradictionSeverity,
    ContradictionStatus,
    EventClassification,
)
from app.models.event import ExtractedEventResponse

logger = logging.getLogger("trace_ai.contradiction_engine")

SPEED_REGEX = re.compile(r"(\d+(?:\.\d+)?)\s*(?:km/h|kph|kmph|mph)", re.IGNORECASE)
STOP_WORDS = {"stop", "stopped", "stopping", "stationary", "standstill", "parked"}
BRAKE_WORDS = {"brake", "braked", "braking", "brakes"}
GREEN_SIGNAL_WORDS = {"green", "green light", "signal was green", "had green"}
RED_SIGNAL_WORDS = {"red", "red light", "signal was red", "ran red"}


def _extract_claimed_speed(text: str, meta: Dict[str, Any]) -> Optional[float]:
    """Extract numeric speed from metadata or statement text."""
    if "claimed_speed_kmh" in meta:
        try:
            return float(meta["claimed_speed_kmh"])
        except (ValueError, TypeError):
            pass
    if "speed_kmh" in meta:
        try:
            return float(meta["speed_kmh"])
        except (ValueError, TypeError):
            pass
    match = SPEED_REGEX.search(text)
    if match:
        try:
            return float(match.group(1))
        except (ValueError, TypeError):
            pass
    return None


def _is_stopped_claim(text: str, event_type: str, meta: Dict[str, Any]) -> bool:
    """Check if event text asserts vehicle was stopped or stationary."""
    if event_type == "vehicle_stopped":
        return True
    if meta.get("claimed_stopped") is True or meta.get("is_stopped") is True:
        return True
    lower = text.lower()
    return any(w in lower for w in STOP_WORDS) and ("not stopped" not in lower) and ("didn't stop" not in lower)


def _is_braking_claim(text: str, event_type: str, meta: Dict[str, Any]) -> bool:
    """Check if event text asserts driver applied brakes."""
    if event_type in {"braking", "brake_applied", "rapid_deceleration"}:
        return True
    if meta.get("brake_status") is True or meta.get("claimed_braking") is True:
        return True
    lower = text.lower()
    return any(w in lower for w in BRAKE_WORDS) and ("no brake" not in lower) and ("didn't brake" not in lower)


def _extract_signal_claim(text: str, meta: Dict[str, Any]) -> Optional[str]:
    """Extract claimed traffic signal status ('green' or 'red')."""
    if "signal_color" in meta:
        return str(meta["signal_color"]).lower()
    lower = text.lower()
    if any(phrase in lower for phrase in GREEN_SIGNAL_WORDS):
        return "green"
    if any(phrase in lower for phrase in RED_SIGNAL_WORDS):
        return "red"
    return None


class ContradictionEngineService:
    """Engine orchestrating deterministic contradiction detection across claims and observations."""

    def analyze_contradictions(
        self,
        incident_id: str,
    ) -> ContradictionEngineResponse:
        """Evaluate all incident claims against sensor telematics, video observations, and peer claims."""
        incident = get_incident(incident_id)
        if not incident:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident with ID '{incident_id}' not found.",
            )

        events = list_events_for_incident(incident_id)
        parties = list_parties_for_incident(incident_id)
        existing_contradictions = list_contradictions_for_incident(incident_id)

        party_map = {p.id: p for p in parties}
        party_by_label = {p.party_label.value: p for p in parties}

        # Segregate events into claims and instrumental observations
        claims = [e for e in events if e.classification == EventClassification.CLAIM]
        observations = [e for e in events if e.classification == EventClassification.OBSERVATION]

        findings: List[ContradictionFinding] = []
        compatible_statements: List[CompatibleStatementItem] = []
        missing_evidence_items: List[MissingEvidenceItem] = []

        # 1. Compare Witness Claims against Sensor Observations
        sensor_events = [
            e for e in observations
            if e.event_type in {"rapid_deceleration", "vehicle_stopped", "sensor_pattern", "speed_measurement"}
            or ("speed_kmh" in (e.metadata or {}))
            or ("brake_status" in (e.metadata or {}))
        ]

        for claim in claims:
            meta = claim.metadata or {}
            c_text = claim.description
            c_meta_party = meta.get("party_label") or claim.source_id
            c_quote = meta.get("original_quote") or c_text

            # Rule 1A: Claimed Stopped vs Sensor Measured Moving
            if _is_stopped_claim(c_text, claim.event_type, meta):
                for obs in sensor_events:
                    obs_meta = obs.metadata or {}
                    obs_speed = obs_meta.get("speed_kmh") or obs_meta.get("initial_speed_kmh") or obs_meta.get("min_speed_kmh")
                    obs_veh = obs_meta.get("vehicle_id") or obs.source_id

                    # Check entity match if vehicle is known
                    if c_meta_party and obs_veh and str(c_meta_party).upper() not in str(obs_veh).upper():
                        continue

                    if obs_speed is not None and float(obs_speed) > 5.0:
                        desc = (
                            f"Party {c_meta_party or 'claimant'} stated vehicle was stopped/stationary "
                            f"('{c_quote}'), but onboard sensor telemetry recorded vehicle speed of "
                            f"{float(obs_speed):.1f} km/h at that time. "
                            f"Factual divergence between testimonial claim and instrumental measurement."
                        )
                        finding = ContradictionFinding(
                            incident_id=incident_id,
                            conflict_type=ConflictType.CLAIM_VS_SENSOR,
                            title="Vehicle Movement vs Claimed Stationary Status",
                            description=desc,
                            topic="vehicle_movement",
                            severity=ContradictionSeverity.CRITICAL,
                            status=ContradictionStatus.DETECTED,
                            event_id_a=claim.id,
                            event_id_b=obs.id,
                            source_a=str(c_meta_party or claim.source_id),
                            source_b=str(obs_veh or obs.source_id),
                            claim_a_id=meta.get("claim_id"),
                            quote_a=c_quote,
                            quote_b=f"Sensor recorded speed: {float(obs_speed):.1f} km/h",
                            timestamp_a=claim.wall_clock_timestamp.isoformat() if claim.wall_clock_timestamp else None,
                            timestamp_b=obs.wall_clock_timestamp.isoformat() if obs.wall_clock_timestamp else None,
                            supporting_observation_ids=[obs.id],
                            evidence_references=obs.evidence_references,
                            is_direct_contradiction=True,
                            resolution_rationale="Physical sensor telemetry directly refutes stationary status.",
                        )
                        findings.append(finding)
                        break

            # Rule 1B: Claimed Speed vs Sensor Speed Measurement
            claimed_speed = _extract_claimed_speed(c_text, meta)
            if claimed_speed is not None:
                matched_sensor = False
                for obs in sensor_events:
                    obs_meta = obs.metadata or {}
                    obs_speed = obs_meta.get("speed_kmh") or obs_meta.get("initial_speed_kmh") or obs_meta.get("max_speed_kmh")
                    obs_veh = obs_meta.get("vehicle_id") or obs.source_id

                    if c_meta_party and obs_veh and str(c_meta_party).upper() not in str(obs_veh).upper():
                        continue

                    if obs_speed is not None:
                        matched_sensor = True
                        delta = abs(claimed_speed - float(obs_speed))
                        # If difference is within 10 km/h, it is compatible (human perception tolerance)
                        if delta <= 10.0:
                            compatible_statements.append(
                                CompatibleStatementItem(
                                    topic="speed_perception",
                                    summary=f"Claimed speed ({claimed_speed} km/h) is compatible with telemetry ({obs_speed} km/h).",
                                    source_a=str(c_meta_party or claim.source_id),
                                    source_b=str(obs_veh or obs.source_id),
                                    quote_a=c_quote,
                                    quote_b=f"Sensor speed: {float(obs_speed):.1f} km/h",
                                    notes="Minor numerical variance within human perception tolerance; not contradictory.",
                                )
                            )
                        elif delta > 15.0:
                            desc = (
                                f"Party {c_meta_party or 'claimant'} claimed traveling at {claimed_speed:.1f} km/h "
                                f"('{c_quote}'), but onboard sensor telemetry recorded {float(obs_speed):.1f} km/h "
                                f"(divergence of {delta:.1f} km/h). "
                                f"Instrumental measurement conflicts with witness speed claim."
                            )
                            finding = ContradictionFinding(
                                incident_id=incident_id,
                                conflict_type=ConflictType.CLAIM_VS_SENSOR,
                                title="Vehicle Speed Divergence",
                                description=desc,
                                topic="speed",
                                severity=ContradictionSeverity.CRITICAL if delta > 30.0 else ContradictionSeverity.MODERATE,
                                status=ContradictionStatus.DETECTED,
                                event_id_a=claim.id,
                                event_id_b=obs.id,
                                source_a=str(c_meta_party or claim.source_id),
                                source_b=str(obs_veh or obs.source_id),
                                claim_a_id=meta.get("claim_id"),
                                quote_a=c_quote,
                                quote_b=f"Sensor recorded speed: {float(obs_speed):.1f} km/h",
                                timestamp_a=claim.wall_clock_timestamp.isoformat() if claim.wall_clock_timestamp else None,
                                timestamp_b=obs.wall_clock_timestamp.isoformat() if obs.wall_clock_timestamp else None,
                                supporting_observation_ids=[obs.id],
                                evidence_references=obs.evidence_references,
                                is_direct_contradiction=True,
                                resolution_rationale=f"Sensor telemetry indicates measured speed of {float(obs_speed):.1f} km/h.",
                            )
                            findings.append(finding)
                        break

            # Check equipment claims lacking telemetry coverage (e.g. horn, hazards, indicators)
            c_lower = c_text.lower()
            if any(k in c_lower for k in ("horn", "hazard", "indicator", "turn signal", "headlight")):
                missing_evidence_items.append(
                    MissingEvidenceItem(
                        source_id=str(c_meta_party or claim.source_id),
                        claim_text=c_text,
                        topic="equipment_activation",
                        suggested_evidence="vehicle_body_control_module_log",
                    )
                )

            # Rule 1C: Claimed Braking vs Sensor Inactive Brake
            if _is_braking_claim(c_text, claim.event_type, meta):
                for obs in sensor_events:
                    obs_meta = obs.metadata or {}
                    brake_active = obs_meta.get("brake_status")
                    accel = obs_meta.get("acceleration")
                    obs_veh = obs_meta.get("vehicle_id") or obs.source_id

                    if c_meta_party and obs_veh and str(c_meta_party).upper() not in str(obs_veh).upper():
                        continue

                    if brake_active is False and (accel is not None and float(accel) >= 0.0):
                        desc = (
                            f"Party {c_meta_party or 'claimant'} asserted brake application ('{c_quote}'), "
                            f"but onboard sensor telemetry recorded brake_status as inactive with non-negative "
                            f"acceleration ({float(accel):.2f} m/s²)."
                        )
                        finding = ContradictionFinding(
                            incident_id=incident_id,
                            conflict_type=ConflictType.CLAIM_VS_SENSOR,
                            title="Braking Claim vs Sensor Status",
                            description=desc,
                            topic="braking",
                            severity=ContradictionSeverity.MODERATE,
                            status=ContradictionStatus.DETECTED,
                            event_id_a=claim.id,
                            event_id_b=obs.id,
                            source_a=str(c_meta_party or claim.source_id),
                            source_b=str(obs_veh or obs.source_id),
                            claim_a_id=meta.get("claim_id"),
                            quote_a=c_quote,
                            quote_b="Sensor brake_status=False, acceleration>=0",
                            timestamp_a=claim.wall_clock_timestamp.isoformat() if claim.wall_clock_timestamp else None,
                            timestamp_b=obs.wall_clock_timestamp.isoformat() if obs.wall_clock_timestamp else None,
                            supporting_observation_ids=[obs.id],
                            evidence_references=obs.evidence_references,
                            is_direct_contradiction=True,
                            resolution_rationale="Sensor telemetry recorded no brake actuation.",
                        )
                        findings.append(finding)
                        break

        # 2. Compare Witness Claims against Video Observations
        video_events = [
            e for e in observations
            if e.event_type in {"visual_object_trajectory", "sudden_visual_motion_change", "visual_trajectory_interaction"}
            or ("source_video_id" in (e.metadata or {}))
        ]

        for claim in claims:
            meta = claim.metadata or {}
            c_text = claim.description
            c_meta_party = meta.get("party_label") or claim.source_id
            c_quote = meta.get("original_quote") or c_text

            sig = _extract_signal_claim(c_text, meta)
            if sig:
                # Check if video observed signal state
                for v_obs in video_events:
                    v_meta = v_obs.metadata or {}
                    observed_sig = v_meta.get("traffic_signal") or v_meta.get("signal_color")
                    if observed_sig and str(observed_sig).lower() != sig:
                        desc = (
                            f"Party {c_meta_party} asserted signal was {sig} ('{c_quote}'), "
                            f"but video analysis recorded signal as {observed_sig}."
                        )
                        finding = ContradictionFinding(
                            incident_id=incident_id,
                            conflict_type=ConflictType.CLAIM_VS_VIDEO,
                            title="Traffic Signal Status Divergence",
                            description=desc,
                            topic="traffic_signal",
                            severity=ContradictionSeverity.CRITICAL,
                            status=ContradictionStatus.RESOLVED,
                            event_id_a=claim.id,
                            event_id_b=v_obs.id,
                            source_a=str(c_meta_party or claim.source_id),
                            source_b=str(v_obs.source_id),
                            claim_a_id=meta.get("claim_id"),
                            quote_a=c_quote,
                            quote_b=f"Video recorded signal: {observed_sig}",
                            supporting_observation_ids=[v_obs.id],
                            evidence_references=v_obs.evidence_references,
                            is_direct_contradiction=True,
                            resolution_rationale="Video observation verified signal phase.",
                        )
                        findings.append(finding)
                        break

        # 3. Compare Incompatible Claims Between Parties (Party V1 vs Party V2)
        v1_party = party_by_label.get("V1")
        v2_party = party_by_label.get("V2")
        v1_party_id = v1_party.id if v1_party else None
        v2_party_id = v2_party.id if v2_party else None

        v1_claims = [
            c for c in claims
            if (c.metadata or {}).get("party_label") == "V1"
            or (v1_party_id and c.source_id == v1_party_id)
            or (c.source_id and "V1" in c.source_id.upper())
        ]
        v2_claims = [
            c for c in claims
            if (c.metadata or {}).get("party_label") == "V2"
            or (v2_party_id and c.source_id == v2_party_id)
            or (c.source_id and "V2" in c.source_id.upper())
        ]

        for c1 in v1_claims:
            m1 = c1.metadata or {}
            t1 = c1.description
            sig1 = _extract_signal_claim(t1, m1)
            speed1 = _extract_claimed_speed(t1, m1)
            stop1 = _is_stopped_claim(t1, c1.event_type, m1)

            for c2 in v2_claims:
                m2 = c2.metadata or {}
                t2 = c2.description
                sig2 = _extract_signal_claim(t2, m2)
                speed2 = _extract_claimed_speed(t2, m2)
                stop2 = _is_stopped_claim(t2, c2.event_type, m2)

                # 3A: Mutually Exclusive Traffic Signal (both claim green on perpendicular paths)
                if sig1 and sig2 and sig1 == "green" and sig2 == "green":
                    # Check if resolved by video
                    video_resolver = next(
                        (vo for vo in video_events if (vo.metadata or {}).get("traffic_signal")),
                        None,
                    )
                    stat = ContradictionStatus.RESOLVED if video_resolver else ContradictionStatus.UNRESOLVED
                    res_note = (
                        "Resolved by video footage."
                        if video_resolver
                        else "Unresolved: Mutually exclusive green signal claims pending independent signal cycle data."
                    )
                    finding = ContradictionFinding(
                        incident_id=incident_id,
                        conflict_type=ConflictType.CLAIM_VS_CLAIM,
                        title="Conflicting Traffic Light Assertions",
                        description=(
                            f"Both parties claim right of way with green signal. Party V1 stated: '{m1.get('original_quote', t1)}'. "
                            f"Party V2 stated: '{m2.get('original_quote', t2)}'. "
                            f"Standard signal phasing precludes simultaneous green on conflicting movements."
                        ),
                        topic="traffic_signal",
                        severity=ContradictionSeverity.CRITICAL,
                        status=stat,
                        event_id_a=c1.id,
                        event_id_b=c2.id,
                        source_a="V1",
                        source_b="V2",
                        claim_a_id=m1.get("claim_id"),
                        claim_b_id=m2.get("claim_id"),
                        quote_a=m1.get("original_quote") or t1,
                        quote_b=m2.get("original_quote") or t2,
                        supporting_observation_ids=[video_resolver.id] if video_resolver else [],
                        evidence_references=video_resolver.evidence_references if video_resolver else [],
                        is_direct_contradiction=True,
                        resolution_rationale=res_note,
                        recommended_evidence_type="traffic_signal_timing_log" if not video_resolver else None,
                    )
                    findings.append(finding)

                # 3B: Stationary Claim vs Peer Driving Claim
                if stop1 and speed2 and speed2 > 30.0:
                    finding = ContradictionFinding(
                        incident_id=incident_id,
                        conflict_type=ConflictType.CLAIM_VS_CLAIM,
                        title="Stopped vs Speeding Dispute",
                        description=(
                            f"Party V1 asserts vehicle was stopped ('{m1.get('original_quote', t1)}'), "
                            f"while Party V2 asserts V1 was moving at high speed ('{m2.get('original_quote', t2)}')."
                        ),
                        topic="vehicle_movement",
                        severity=ContradictionSeverity.CRITICAL,
                        status=ContradictionStatus.UNRESOLVED,
                        event_id_a=c1.id,
                        event_id_b=c2.id,
                        source_a="V1",
                        source_b="V2",
                        claim_a_id=m1.get("claim_id"),
                        claim_b_id=m2.get("claim_id"),
                        quote_a=m1.get("original_quote") or t1,
                        quote_b=m2.get("original_quote") or t2,
                        is_direct_contradiction=True,
                        resolution_rationale="Requires telemetry or video to corroborate speed or stationary status.",
                        recommended_evidence_type="telematics",
                    )
                    findings.append(finding)

        # 4. Identify Conflicting Event Sequences when Timing is Comparable
        timed_claims = [c for c in claims if c.wall_clock_timestamp is not None]
        for i, ca in enumerate(timed_claims):
            for cb in timed_claims[i + 1:]:
                # If claim ca asserts event A happened before event B, but timestamps show reverse
                ts_a = ca.wall_clock_timestamp
                ts_b = cb.wall_clock_timestamp
                if ts_a and ts_b and abs((ts_a - ts_b).total_seconds()) > 2.0:
                    # Check text for sequence claims
                    t_a_lower = ca.description.lower()
                    t_b_lower = cb.description.lower()
                    if ("first" in t_a_lower or "before" in t_a_lower) and ts_a > ts_b:
                        finding = ContradictionFinding(
                            incident_id=incident_id,
                            conflict_type=ConflictType.TEMPORAL_SEQUENCE,
                            title="Event Sequence Inversion",
                            description=(
                                f"Party claimed priority/precedence in sequence ('{ca.description}'), "
                                f"but recorded timestamps place event at {ts_a.isoformat()} after "
                                f"peer event at {ts_b.isoformat()}."
                            ),
                            topic="chronological_sequence",
                            severity=ContradictionSeverity.MODERATE,
                            status=ContradictionStatus.DETECTED,
                            event_id_a=ca.id,
                            event_id_b=cb.id,
                            source_a=ca.source_id,
                            source_b=cb.source_id,
                            timestamp_a=ts_a.isoformat(),
                            timestamp_b=ts_b.isoformat(),
                            is_direct_contradiction=True,
                            resolution_rationale="Objective timestamp sequence inverts claimed order of events.",
                        )
                        findings.append(finding)

        # 5. Persist newly detected findings into contradictions table
        existing_titles = {c.title for c in existing_contradictions}
        for f in findings:
            if f.title not in existing_titles:
                create_contradiction(
                    ContradictionCreate(
                        incident_id=incident_id,
                        title=f.title,
                        description=f.description,
                        event_id_a=f.event_id_a,
                        event_id_b=f.event_id_b,
                        severity=f.severity,
                        status=f.status,
                    )
                )

        # 6. Record Analysis Run
        analysis_id = str(uuid4())
        direct_count = sum(1 for f in findings if f.is_direct_contradiction)
        unresolved_count = sum(1 for f in findings if f.status in {ContradictionStatus.UNRESOLVED, ContradictionStatus.DETECTED})

        summary = (
            f"Forensic contradiction detection for incident '{incident_id}'. "
            f"Analyzed {len(claims)} testimonial claims against {len(observations)} instrumental observations. "
            f"Identified {len(findings)} factual contradictions ({direct_count} direct, {unresolved_count} unresolved), "
            f"{len(compatible_statements)} compatible statement pairs, and "
            f"{len(missing_evidence_items)} unverified claims due to missing telemetry/video coverage."
        )

        create_analysis_run(
            AnalysisRunCreate(
                incident_id=incident_id,
                run_type="contradiction_detection",
                status=AnalysisRunStatus.COMPLETED,
                summary=summary,
                findings={
                    "analysis_id": analysis_id,
                    "total_contradictions": len(findings),
                    "direct_contradictions": direct_count,
                    "unresolved_contradictions": unresolved_count,
                    "compatible_statements": len(compatible_statements),
                    "missing_evidence_items": len(missing_evidence_items),
                },
            )
        )

        logger.info(
            "Contradiction detection completed: incident=%s findings=%d direct=%d unresolved=%d",
            incident_id,
            len(findings),
            direct_count,
            unresolved_count,
        )

        return ContradictionEngineResponse(
            incident_id=incident_id,
            total_contradictions=len(findings),
            direct_contradictions_count=direct_count,
            unresolved_count=unresolved_count,
            findings=findings,
            compatible_statements=compatible_statements,
            missing_evidence_items=missing_evidence_items,
        )


contradiction_engine_service = ContradictionEngineService()
