"""Unit tests for sensor CSV analysis service and kinematic pattern detection."""

import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import (
    create_incident,
    get_evidence,
    get_incident_detail,
    list_analysis_runs_for_incident,
    list_events_for_incident,
)
from app.main import app
from app.models import (
    EvidenceType,
    IncidentCreate,
    ProcessingStatus,
)
from app.services.sensor_analysis import sensor_analysis_service

client = TestClient(app)


def test_parse_valid_sensor_csv_with_utc_timestamps():
    """Verify parsing sensor CSV with UTC timestamps, preserving row numbers and traceability."""
    incident = create_incident(IncidentCreate(title="Telematics Ingestion Test"))

    csv_text = (
        "timestamp,vehicle_id,speed,acceleration,latitude,longitude,brake_status\n"
        "2026-10-31T01:00:00Z,V1,50.0,0.1,40.7128,-74.0060,0\n"
        "2026-10-31T01:00:01Z,V1,52.0,0.5,40.7129,-74.0059,0\n"
        "2026-10-31T01:00:02Z,V1,51.5,-0.1,40.7130,-74.0058,0\n"
    )

    # 1. Upload CSV as evidence
    files = {"file": ("v1_telematics.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    up_resp = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    assert up_resp.status_code == 201
    evidence_id = up_resp.json()["id"]

    # 2. Trigger sensor analysis
    response = client.post(
        f"/api/incidents/{incident.id}/evidence/{evidence_id}/analyze-sensor"
    )
    assert response.status_code == 200
    data = response.json()

    assert data["incident_id"] == incident.id
    assert data["evidence_id"] == evidence_id
    assert data["total_rows_read"] == 3
    assert data["valid_samples_count"] == 3
    assert data["malformed_rows_count"] == 0

    # Verify evidence status updated to completed
    ev = get_evidence(evidence_id)
    assert ev.processing_status == ProcessingStatus.COMPLETED

    # Verify analysis run recorded
    runs = list_analysis_runs_for_incident(incident.id)
    assert any(r.run_type == "sensor_analysis" for r in runs)


def test_parse_valid_sensor_csv_with_relative_seconds():
    """Verify elapsed relative seconds are preserved separately from wall-clock timestamps."""
    incident = create_incident(IncidentCreate(title="Relative Telematics Test"))

    csv_text = (
        "elapsed_seconds,vehicle_id,speed_kmh\n"
        "0.0,V2,40.0\n"
        "1.0,V2,42.0\n"
        "2.0,V2,41.0\n"
    )

    files = {"file": ("v2_relative.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    up_resp = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    evidence_id = up_resp.json()["id"]

    response = client.post(
        f"/api/incidents/{incident.id}/evidence/{evidence_id}/analyze-sensor"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid_samples_count"] == 3


def test_detect_rapid_deceleration_without_collision_inference():
    """Verify rapid deceleration is flagged as an observable kinematic metric without inferring collision."""
    incident = create_incident(IncidentCreate(title="Heavy Braking Observation"))

    csv_text = (
        "timestamp,vehicle_id,speed\n"
        "2026-10-31T01:00:00Z,V1,60.0\n"
        "2026-10-31T01:00:01Z,V1,60.0\n"
        "2026-10-31T01:00:02Z,V1,15.0\n"  # Drops 45 km/h in 1 sec (~ -12.5 m/s^2)
    )

    files = {"file": ("braking_telematics.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    up_resp = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    evidence_id = up_resp.json()["id"]

    response = client.post(
        f"/api/incidents/{incident.id}/evidence/{evidence_id}/analyze-sensor"
    )
    assert response.status_code == 200
    data = response.json()

    # Must detect rapid_deceleration
    patterns = data["patterns_detected"]
    decel_patterns = [p for p in patterns if p["pattern_type"] == "rapid_deceleration"]
    assert len(decel_patterns) == 1

    decel = decel_patterns[0]
    assert decel["vehicle_id"] == "V1"
    assert decel["row_start"] == 3
    assert decel["row_end"] == 4
    # Critical Rule 9: Must NOT infer collision
    assert "does not infer a collision" in decel["description"].lower()
    assert "collision" not in decel["pattern_type"].lower()

    # Verify event recorded in DB
    events = list_events_for_incident(incident.id)
    assert any(e.event_type == "rapid_deceleration" for e in events)


def test_detect_vehicle_stopped():
    """Verify vehicle stopping is detected and indexed with row number."""
    incident = create_incident(IncidentCreate(title="Vehicle Stop Test"))

    csv_text = (
        "timestamp,vehicle_id,speed\n"
        "2026-10-31T01:00:00Z,V1,30.0\n"
        "2026-10-31T01:00:01Z,V1,0.0\n"
        "2026-10-31T01:00:02Z,V1,0.0\n"
    )

    files = {"file": ("stop_telematics.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    up_resp = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    evidence_id = up_resp.json()["id"]

    response = client.post(
        f"/api/incidents/{incident.id}/evidence/{evidence_id}/analyze-sensor"
    )
    assert response.status_code == 200
    data = response.json()

    stop_patterns = [p for p in data["patterns_detected"] if p["pattern_type"] == "vehicle_stopped"]
    assert len(stop_patterns) >= 1
    assert stop_patterns[0]["row_start"] == 3


def test_detect_sensor_data_gap_without_fabrication():
    """Verify sensor data gaps are reported as missing observations rather than fabricated values."""
    incident = create_incident(IncidentCreate(title="Data Gap Test"))

    csv_text = (
        "timestamp,vehicle_id,speed\n"
        "2026-10-31T01:00:00Z,V1,40.0\n"
        "2026-10-31T01:00:08Z,V1,38.0\n"  # 8.0 second jump
    )

    files = {"file": ("gap_telematics.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    up_resp = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    evidence_id = up_resp.json()["id"]

    response = client.post(
        f"/api/incidents/{incident.id}/evidence/{evidence_id}/analyze-sensor"
    )
    assert response.status_code == 200
    data = response.json()

    gap_patterns = [p for p in data["patterns_detected"] if p["pattern_type"] == "sensor_data_gap"]
    assert len(gap_patterns) == 1
    assert "not fabricated" in gap_patterns[0]["description"].lower()
    assert gap_patterns[0]["metrics"]["gap_duration_seconds"] == 8.0


def test_reject_missing_required_columns():
    """Verify CSV missing required columns (e.g. speed) is rejected with 400 Bad Request."""
    incident = create_incident(IncidentCreate(title="Missing Speed Test"))

    csv_text = (
        "timestamp,vehicle_id,temperature\n"
        "2026-10-31T01:00:00Z,V1,22.5\n"
    )

    files = {"file": ("no_speed.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    up_resp = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    evidence_id = up_resp.json()["id"]

    response = client.post(
        f"/api/incidents/{incident.id}/evidence/{evidence_id}/analyze-sensor"
    )
    assert response.status_code == 400
    assert "missing required columns" in response.json()["error"].lower()
    assert "speed" in response.json()["error"].lower()


def test_reject_malformed_rows_and_preserve_traceability():
    """Verify malformed row is logged with line number while valid rows are processed."""
    incident = create_incident(IncidentCreate(title="Malformed Row Test"))

    csv_text = (
        "timestamp,vehicle_id,speed\n"
        "2026-10-31T01:00:00Z,V1,40.0\n"
        "2026-10-31T01:00:01Z,V1,invalid_speed_string\n"  # Row 3 invalid
        "2026-10-31T01:00:02Z,V1,42.0\n"
    )

    files = {"file": ("corrupted_row.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    up_resp = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    evidence_id = up_resp.json()["id"]

    response = client.post(
        f"/api/incidents/{incident.id}/evidence/{evidence_id}/analyze-sensor"
    )
    assert response.status_code == 200
    data = response.json()

    assert data["total_rows_read"] == 3
    assert data["valid_samples_count"] == 2
    assert data["malformed_rows_count"] == 1

    err = data["malformed_row_errors"][0]
    assert err["row_number"] == 3
    assert err["column"] == "speed"
    assert "invalid_speed_string" in str(err["raw_value"])


def test_reject_all_malformed_csv_returns_400():
    """Verify CSV with zero valid rows returns 400 Bad Request."""
    incident = create_incident(IncidentCreate(title="Empty Valid Rows Test"))

    csv_text = (
        "timestamp,vehicle_id,speed\n"
        "2026-10-31T01:00:00Z,V1,corrupt_1\n"
        "2026-10-31T01:00:01Z,V1,corrupt_2\n"
    )

    files = {"file": ("all_corrupt.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    up_resp = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    evidence_id = up_resp.json()["id"]

    response = client.post(
        f"/api/incidents/{incident.id}/evidence/{evidence_id}/analyze-sensor"
    )
    assert response.status_code == 400
    assert "malformed" in response.json()["error"].lower()
