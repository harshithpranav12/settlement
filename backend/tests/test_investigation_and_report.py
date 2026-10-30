"""Tests for investigation workflow and report generation services & endpoints."""

import io
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import (
    create_event,
    create_evidence,
    create_incident,
    create_party,
)
from app.main import app
from app.models import (
    EventClassification,
    EvidenceCreate,
    EvidenceType,
    ExtractedEventCreate,
    IncidentCreate,
    PartyCreate,
    PartyLabel,
)

client = TestClient(app)


def _setup_full_case():
    """Create an incident with 2 parties, video evidence, sensor telemetry, and observations."""
    incident = create_incident(IncidentCreate(title="Main St Collision Case", location="Main & 5th"))

    # Parties with conflicting statements
    p1 = create_party(
        incident.id,
        PartyCreate(
            party_label=PartyLabel.V1,
            name="Driver Alpha",
            vehicle_registration="KA-01-A",
            statement="I was driving at 40 km/h and had green light when V2 hit me.",
        ),
    )
    p2 = create_party(
        incident.id,
        PartyCreate(
            party_label=PartyLabel.V2,
            name="Driver Beta",
            vehicle_registration="KA-02-B",
            statement="I was stopped at red, then entered when light turned green. V1 was speeding at 70 km/h.",
        ),
    )

    # Video evidence
    vid = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.DASHCAM_VIDEO,
            original_filename="front_dashcam.mp4",
            storage_reference="uploads/front_dashcam.mp4",
        )
    )

    # Video observation events
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id=vid.id,
            event_type="vehicle_detection",
            description="Vehicle TRACK_1 entered intersection at 10.5s",
            classification=EventClassification.OBSERVATION,
            video_offset_seconds=10.5,
            confidence=0.92,
            metadata={"frame_number": 315, "vehicle_id": "TRACK_1", "bbox": {"x": 100, "y": 150, "width": 200, "height": 120}},
        )
    )

    # Sensor evidence
    sensor = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.TELEMATICS,
            original_filename="telematics_v1.csv",
            storage_reference="uploads/telematics_v1.csv",
        )
    )

    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id=sensor.id,
            event_type="rapid_deceleration",
            description="Speed decreased from 42.0 km/h to 5.0 km/h in 0.8s",
            classification=EventClassification.OBSERVATION,
            confidence=0.95,
            metadata={"row_index": 45, "speed_kmh": 5.0, "source_filename": "telematics_v1.csv"},
        )
    )

    return incident, p1, p2, vid, sensor


def test_investigation_awaiting_statements():
    """Verify investigation status is awaiting_initial_statements when parties lack statements."""
    incident = create_incident(IncidentCreate(title="Incomplete Case"))
    res = client.get(f"/api/incidents/{incident.id}/investigate")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "awaiting_initial_statements"
    assert not data["is_conclusive"]


def test_investigation_workflow_full_case():
    """Verify investigation workflow runs and produces summary, requests, and ready_for_review status."""
    incident, p1, p2, vid, sensor = _setup_full_case()

    res = client.post(f"/api/incidents/{incident.id}/investigate")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["ready_for_review", "awaiting_evidence"]
    assert data["run_count"] >= 1
    assert "parties_summary" in data
    assert "evidence_summary" in data
    assert "disclaimer" in data
    assert "does not determine legal fault" in data["disclaimer"].lower()


def test_report_generation_all_10_sections():
    """Verify GET and POST /api/incidents/{id}/report returns all 10 required sections without legal liability."""
    incident, p1, p2, vid, sensor = _setup_full_case()

    res = client.get(f"/api/incidents/{incident.id}/report")
    assert res.status_code == 200
    rep = res.json()

    # Section 1: Incident summary
    assert rep["incident_summary"]["id"] == incident.id
    assert rep["incident_summary"]["title"] == "Main St Collision Case"

    # Section 2: Parties and statements
    assert len(rep["parties"]) == 2
    assert rep["parties"][0]["statement"] is not None

    # Section 3: Chronological timeline
    assert isinstance(rep["timeline"], list)

    # Section 4: Video observations with frame refs
    assert len(rep["video_observations"]) >= 1
    assert rep["video_observations"][0]["frame_number"] == 315
    assert rep["video_observations"][0]["vehicle_id"] == "TRACK_1"

    # Section 5: Sensor observations with row refs
    assert len(rep["sensor_observations"]) >= 1
    assert rep["sensor_observations"][0]["row_number"] == 45
    assert rep["sensor_observations"][0]["source_filename"] == "telematics_v1.csv"

    # Section 6: Conflicting claims
    assert isinstance(rep["conflicting_claims"], list)

    # Section 7: Supporting evidence
    assert len(rep["evidence_support"]) >= 1

    # Section 8: Unresolved questions & missing evidence
    assert isinstance(rep["unresolved_questions"], list)
    assert isinstance(rep["missing_evidence"], list)

    # Section 9: Limitations of evidence
    assert len(rep["evidence_limitations"]) >= 4
    limitations_text = " ".join(rep["evidence_limitations"]).lower()
    assert "absence from video" in limitations_text
    assert "pixel space" in limitations_text

    # Section 10: Executive summary
    assert len(rep["executive_summary"]) > 20
    assert "liability" in rep["disclaimer"].lower()


def test_report_caching_and_refresh():
    """Verify that report is stored in SQLite and can be retrieved or refreshed."""
    incident, p1, p2, vid, sensor = _setup_full_case()

    # First generation
    res1 = client.get(f"/api/incidents/{incident.id}/report")
    assert res1.status_code == 200
    report_id_1 = res1.json()["report_id"]

    # Second retrieval (cached)
    res2 = client.get(f"/api/incidents/{incident.id}/report")
    assert res2.status_code == 200
    assert res2.json()["report_id"] == report_id_1

    # Force refresh
    res3 = client.get(f"/api/incidents/{incident.id}/report?refresh=true")
    assert res3.status_code == 200
    report_id_3 = res3.json()["report_id"]
    assert report_id_3 != report_id_1
