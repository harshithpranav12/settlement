"""Unit and integration tests for the contradiction engine.

Tests cover:
- Conflicting witness statements
- Compatible statements (differences in wording / perception)
- Missing timestamps
- Incomparable clock times & absence from video (absence of evidence is not evidence of absence)
- Video observations that do not fully resolve a disagreement
- Direct sensor telematics contradictions
"""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.database import (
    create_event,
    create_incident,
    create_party,
    list_contradictions_for_incident,
)
from app.main import app
from app.models import (
    ContradictionSeverity,
    ContradictionStatus,
    EventClassification,
    ExtractedEventCreate,
    IncidentCreate,
    PartyCreate,
    PartyLabel,
)
from app.services.contradiction_engine import contradiction_engine_service

client = TestClient(app)


def test_conflicting_witness_statements_traffic_signal():
    """Verify incompatible witness claims on traffic light phase generate an unresolved contradiction."""
    incident = create_incident(IncidentCreate(title="Signal Conflict Incident"))

    p1 = create_party(incident.id, PartyCreate(party_label=PartyLabel.V1, name="Alice", vehicle_registration="KA-01-AB-1234", statement="I entered on a solid green light."))
    p2 = create_party(incident.id, PartyCreate(party_label=PartyLabel.V2, name="Bob", vehicle_registration="MH-02-CD-5678", statement="I had the green light and proceeded."))

    # V1 claim event
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id=p1.id,
            event_type="traffic_signal",
            description="Party V1 claims they entered junction on green signal.",
            classification=EventClassification.CLAIM,
            metadata={"party_label": "V1", "signal_color": "green", "original_quote": "I entered on a solid green light."},
        )
    )

    # V2 claim event
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id=p2.id,
            event_type="traffic_signal",
            description="Party V2 claims their traffic light was green.",
            classification=EventClassification.CLAIM,
            metadata={"party_label": "V2", "signal_color": "green", "original_quote": "I had the green light and proceeded."},
        )
    )

    resp = client.get(f"/api/incidents/{incident.id}/contradictions")
    assert resp.status_code == 200
    data = resp.json()

    assert data["incident_id"] == incident.id
    assert data["total_contradictions"] >= 1
    assert data["direct_contradictions_count"] >= 1

    # Find traffic signal conflict
    sig_conflict = next((f for f in data["findings"] if f["topic"] == "traffic_signal"), None)
    assert sig_conflict is not None
    assert sig_conflict["conflict_type"] == "claim_vs_claim"
    assert sig_conflict["severity"] == "critical"
    # Status is unresolved because no video/log confirms which party had the green light
    assert sig_conflict["status"] == "unresolved"
    assert sig_conflict["recommended_evidence_type"] == "traffic_signal_timing_log"
    assert "precludes simultaneous green" in sig_conflict["description"]

    # Verify forensic neutrality (no accusation of lying or dishonesty)
    desc_lower = sig_conflict["description"].lower()
    assert "lying" not in desc_lower
    assert "deceptive" not in desc_lower
    assert "dishonest" not in desc_lower

    # Verify stored in SQLite contradictions table
    db_contradictions = list_contradictions_for_incident(incident.id)
    assert any(c.title == "Conflicting Traffic Light Assertions" for c in db_contradictions)


def test_compatible_statements_mere_difference_in_wording():
    """Verify statement differing only slightly in perception/wording is marked compatible, not a contradiction."""
    incident = create_incident(IncidentCreate(title="Speed Perception Tolerance Incident"))

    p1 = create_party(incident.id, PartyCreate(party_label=PartyLabel.V1, name="Driver 1", vehicle_registration="KA-05-XY-9999", statement="I was driving at 40 km/h."))

    # V1 claim: 40 km/h
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id=p1.id,
            event_type="speed_claim",
            description="Driver claimed traveling at 40 km/h.",
            classification=EventClassification.CLAIM,
            metadata={"party_label": "V1", "claimed_speed_kmh": 40.0, "original_quote": "I was driving at 40 km/h."},
        )
    )

    # Sensor observation: 42.5 km/h (delta = 2.5 km/h, well within human estimation tolerance)
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="V1",
            event_type="speed_measurement",
            description="Vehicle V1 sensor telematics recorded 42.5 km/h.",
            classification=EventClassification.OBSERVATION,
            metadata={"vehicle_id": "V1", "speed_kmh": 42.5},
        )
    )

    resp = client.get(f"/api/incidents/{incident.id}/contradictions")
    assert resp.status_code == 200
    data = resp.json()

    # Must NOT be flagged as a contradiction
    assert not any(f["topic"] == "speed" for f in data["findings"])

    # Must be recorded in compatible_statements
    assert len(data["compatible_statements"]) >= 1
    compatible = data["compatible_statements"][0]
    assert compatible["topic"] == "speed_perception"
    assert "40" in compatible["quote_a"]
    assert "42.5" in compatible["quote_b"]
    assert "not contradictory" in compatible["notes"].lower()


def test_claim_with_missing_timestamp():
    """Verify claim with unknown timestamp is evaluated against available sensor data without error."""
    incident = create_incident(IncidentCreate(title="Missing Timestamp Claim Test"))

    # Claim with NO wall_clock_timestamp and NO video_offset
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="party_v1",
            event_type="statement_claim",
            description="Driver V1 insists vehicle was stopped at the moment of impact.",
            classification=EventClassification.CLAIM,
            wall_clock_timestamp=None,
            video_offset_seconds=None,
            metadata={"party_label": "V1", "claimed_stopped": True, "original_quote": "vehicle was stopped"},
        )
    )

    # Sensor observation showing V1 speed was 46.0 km/h
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="V1",
            event_type="rapid_deceleration",
            description="Deceleration event from 46.0 km/h to 15.0 km/h.",
            classification=EventClassification.OBSERVATION,
            metadata={"vehicle_id": "V1", "speed_kmh": 46.0},
        )
    )

    resp = client.post(f"/api/incidents/{incident.id}/detect-contradictions")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_contradictions"] >= 1
    finding = data["findings"][0]
    assert finding["conflict_type"] == "claim_vs_sensor"
    assert finding["title"] == "Vehicle Movement vs Claimed Stationary Status"
    assert "46.0 km/h" in finding["description"]


def test_incomparable_clock_times_and_absence_from_video():
    """Verify engine handles uncalibrated video times and does not treat absence from video as proof of non-occurrence."""
    incident = create_incident(IncidentCreate(title="Absence From Video Test"))

    # Claim that driver sounded horn and flashed hazards
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="party_v1",
            event_type="equipment_claim",
            description="I sounded my horn and switched on hazard lights before the corner.",
            classification=EventClassification.CLAIM,
            wall_clock_timestamp=None,
            metadata={"party_label": "V1"},
        )
    )

    # Video track that captured movement but has no audio or hazard angle
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="cv_track_1",
            event_type="visual_object_trajectory",
            description="Vehicle observed in dashcam.",
            classification=EventClassification.OBSERVATION,
            video_offset_seconds=5.0,
            metadata={"vehicle_id": "V1"},
        )
    )

    resp = client.get(f"/api/incidents/{incident.id}/contradictions")
    assert resp.status_code == 200
    data = resp.json()

    # Must NOT generate a contradiction asserting driver lied about horn
    assert len(data["findings"]) == 0

    # Must generate a missing evidence item noting camera coverage limits
    assert len(data["missing_evidence_items"]) >= 1
    item = data["missing_evidence_items"][0]
    assert "Absence from video footage or sensor telemetry does not constitute proof of non-occurrence" in item["camera_coverage_note"]


def test_video_observations_that_do_not_fully_resolve_disagreement():
    """Verify video observations that do not show the critical signal keep contradiction as unresolved."""
    incident = create_incident(IncidentCreate(title="Incomplete Video Coverage Test"))

    # Conflicting speed claims: V1 says they were stopped; V2 says V1 was driving fast at 60 km/h
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="party_v1",
            event_type="speed_claim",
            description="V1 asserts: I was completely stopped at the intersection line.",
            classification=EventClassification.CLAIM,
            metadata={"party_label": "V1", "claimed_stopped": True, "original_quote": "completely stopped"},
        )
    )

    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="party_v2",
            event_type="speed_claim",
            description="V2 asserts: V1 was speeding through at 60 km/h without stopping.",
            classification=EventClassification.CLAIM,
            metadata={"party_label": "V2", "claimed_speed_kmh": 60.0, "original_quote": "speeding through at 60 km/h"},
        )
    )

    # Video observation that observed V2, but V1 was out of frame / occluded
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="cv_track_v2",
            event_type="visual_object_trajectory",
            description="Vehicle V2 observed at constant speed in video.",
            classification=EventClassification.OBSERVATION,
            video_offset_seconds=14.0,
            metadata={"vehicle_id": "V2"},
        )
    )

    resp = client.get(f"/api/incidents/{incident.id}/contradictions")
    assert resp.status_code == 200
    data = resp.json()

    # The stopped vs speeding dispute cannot be resolved by V2's video alone
    assert data["total_contradictions"] >= 1
    finding = next((f for f in data["findings"] if f["title"] == "Stopped vs Speeding Dispute"), None)
    assert finding is not None
    assert finding["status"] == "unresolved"
    assert "Requires telemetry or video to corroborate speed or stationary status" in finding["resolution_rationale"]
    assert finding["recommended_evidence_type"] == "telematics"
