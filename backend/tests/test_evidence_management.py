"""Automated tests for evidence management endpoints and services."""

import io
import json
from pathlib import Path
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import (
    create_evidence_request,
    create_incident,
    create_party,
    get_evidence,
    get_evidence_request,
    list_evidence_for_incident,
)
from app.main import app
from app.models import (
    EvidenceRequestCreate,
    EvidenceRequestStatus,
    EvidenceType,
    IncidentCreate,
    PartyCreate,
    PartyLabel,
    ProcessingStatus,
)

client = TestClient(app)


# ============================================================================
# 1. VALID MULTIPART UPLOADS (VIDEO & SENSOR CSV)
# ============================================================================

def test_multipart_upload_valid_video():
    """Verify multipart video upload streams to disk, indexes metadata, and assigns safe filename."""
    incident = create_incident(IncidentCreate(title="Crash with Dashcam Footage"))
    party = create_party(
        incident.id,
        PartyCreate(party_label=PartyLabel.V1, name="Alice", vehicle_registration="NY-111"),
    )

    video_bytes = b"\x00\x00\x00\x20ftypisom" + b"simulated_mp4_video_content" * 50
    files = {"file": ("front_dashcam.mp4", io.BytesIO(video_bytes), "video/mp4")}
    data = {
        "evidence_type": "dashcam_video",
        "party_id": party.id,
        "metadata": json.dumps({"camera_view": "front", "fps": 30}),
    }

    response = client.post(f"/api/incidents/{incident.id}/evidence", files=files, data=data)
    assert response.status_code == 201

    resp_json = response.json()
    assert resp_json["incident_id"] == incident.id
    assert resp_json["party_id"] == party.id
    assert resp_json["evidence_type"] == EvidenceType.DASHCAM_VIDEO.value
    assert resp_json["original_filename"] == "front_dashcam.mp4"
    assert resp_json["processing_status"] == ProcessingStatus.UPLOADED.value

    # Verify file saved on disk
    saved_path = Path(resp_json["storage_reference"])
    assert saved_path.exists()
    assert saved_path.read_bytes() == video_bytes

    # Safe filename: must not be just user input; should include uuid prefix
    assert "front_dashcam" in saved_path.name
    assert saved_path.name != "front_dashcam.mp4"

    # Verify metadata in DB
    assert resp_json["metadata"]["file_size_bytes"] == len(video_bytes)
    assert "sha256" in resp_json["metadata"]
    assert resp_json["metadata"]["camera_view"] == "front"


def test_multipart_upload_valid_sensor_csv():
    """Verify multipart CSV sensor telematics upload saves and calculates metadata."""
    incident = create_incident(IncidentCreate(title="Telematics Investigation"))

    csv_content = (
        "timestamp,speed_kmh,accel_x,accel_y,brake_active\n"
        "2026-10-31T01:00:00Z,42.5,0.1,-0.2,0\n"
        "2026-10-31T01:00:01Z,44.1,0.3,-0.1,0\n"
        "2026-10-31T01:00:02Z,12.0,-2.5,-0.4,1\n"
    ).encode("utf-8")

    files = {"file": ("can_bus_telematics.csv", io.BytesIO(csv_content), "text/csv")}
    response = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    assert response.status_code == 201

    resp_json = response.json()
    assert resp_json["evidence_type"] == EvidenceType.TELEMATICS.value
    assert resp_json["original_filename"] == "can_bus_telematics.csv"

    saved_path = Path(resp_json["storage_reference"])
    assert saved_path.exists()
    assert saved_path.read_bytes() == csv_content


# ============================================================================
# 2. STRUCTURED WITNESS STATEMENT UPLOAD (JSON)
# ============================================================================

def test_witness_statement_json_upload():
    """Verify structured witness statements submitted as JSON are preserved and stored."""
    incident = create_incident(IncidentCreate(title="Pedestrian Witness Statement"))

    payload = {
        "witness_name": "Marcus Vance",
        "statement": "I was waiting across the street. The blue sedan accelerated as the light turned yellow.",
        "party_label": None,
        "metadata": {"witness_contact": "555-0199", "location": "SW Corner"},
    }

    response = client.post(
        f"/api/incidents/{incident.id}/evidence",
        json=payload,
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 201

    resp_json = response.json()
    assert resp_json["evidence_type"] == EvidenceType.WITNESS_STATEMENT.value
    assert resp_json["metadata"]["witness_name"] == "Marcus Vance"
    assert resp_json["processing_status"] == ProcessingStatus.COMPLETED.value

    # Verify statement text preserved in storage reference file
    saved_file = Path(resp_json["storage_reference"])
    assert saved_file.exists()
    file_data = json.loads(saved_file.read_text(encoding="utf-8"))
    assert file_data["witness_name"] == "Marcus Vance"
    assert "accelerated as the light turned yellow" in file_data["statement"]


# ============================================================================
# 3. ERROR HANDLING & RESTRICTIONS
# ============================================================================

def test_upload_missing_incident_returns_404():
    """Verify uploading evidence to non-existent incident returns 404."""
    video_bytes = b"test video"
    files = {"file": ("clip.mp4", io.BytesIO(video_bytes), "video/mp4")}
    response = client.post("/api/incidents/non-existent-uuid/evidence", files=files)
    assert response.status_code == 404
    assert "not found" in response.json()["error"].lower()


def test_upload_invalid_file_format_returns_415():
    """Verify unsupported file extensions are rejected with 415 Unsupported Media Type."""
    incident = create_incident(IncidentCreate(title="Crash with Malicious File"))

    executable_bytes = b"MZ\x90\x00\x03\x00\x00\x00"  # PE binary header
    files = {"file": ("malware_payload.exe", io.BytesIO(executable_bytes), "application/octet-stream")}

    response = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    assert response.status_code == 415
    assert "unsupported file format" in response.json()["error"].lower()


def test_upload_oversized_file_returns_413():
    """Verify oversized file upload aborts via bounded streaming and cleans disk."""
    incident = create_incident(IncidentCreate(title="Crash with Giant File"))

    large_bytes = b"A" * 2000  # 2000 bytes

    # Temporarily set max size to 500 bytes to test streaming abort
    with patch.object(settings.__class__, "max_upload_size_bytes", property(lambda self: 500)):
        files = {"file": ("huge_dashcam.mp4", io.BytesIO(large_bytes), "video/mp4")}
        response = client.post(f"/api/incidents/{incident.id}/evidence", files=files)

    assert response.status_code == 413
    assert "exceeds maximum allowed limit" in response.json()["error"].lower()

    # Ensure no partial file was left on disk in upload directory
    incident_dir = Path(settings.UPLOAD_DIR) / "incidents" / incident.id
    if incident_dir.exists():
        assert len(list(incident_dir.glob("*.mp4"))) == 0


def test_path_traversal_prevention():
    """Verify user-supplied path traversal sequences in filenames are neutralized."""
    incident = create_incident(IncidentCreate(title="Traversal Attack Incident"))

    files = {"file": ("../../../../etc/passwd.mp4", io.BytesIO(b"video content"), "video/mp4")}
    response = client.post(f"/api/incidents/{incident.id}/evidence", files=files)
    assert response.status_code == 201

    saved_path = Path(response.json()["storage_reference"])
    # Must be safely inside the incident directory, not anywhere else
    expected_parent = Path(settings.UPLOAD_DIR) / "incidents" / incident.id
    assert saved_path.parent.resolve() == expected_parent.resolve()


# ============================================================================
# 4. EVIDENCE REQUEST LINKING & DISMISSAL
# ============================================================================

def test_evidence_request_fulfillment_via_upload():
    """Verify uploading evidence addressing an evidence request marks it fulfilled."""
    incident = create_incident(IncidentCreate(title="Crash with Requested Junction Footage"))
    req = create_evidence_request(
        EvidenceRequestCreate(
            incident_id=incident.id,
            request_type="cctv_footage",
            description="Request traffic junction video at 14:15 UTC",
            target_party="City Traffic Dept",
            status=EvidenceRequestStatus.PENDING,
        )
    )

    files = {"file": ("junction_cam_42.mp4", io.BytesIO(b"cctv footage bytes"), "video/mp4")}
    data = {"evidence_request_id": req.id}

    response = client.post(f"/api/incidents/{incident.id}/evidence", files=files, data=data)
    assert response.status_code == 201
    evidence_id = response.json()["id"]

    # Verify evidence request in database is marked fulfilled
    updated_req = get_evidence_request(req.id)
    assert updated_req.status == EvidenceRequestStatus.FULFILLED
    assert updated_req.fulfilled_evidence_id == evidence_id


def test_dismiss_evidence_request():
    """Verify POST /api/incidents/{id}/evidence-requests/{req_id}/dismiss marks request dismissed."""
    incident = create_incident(IncidentCreate(title="Crash with Dismissible Request"))
    req = create_evidence_request(
        EvidenceRequestCreate(
            incident_id=incident.id,
            request_type="dashcam_video",
            description="Request rear camera footage from V2",
            target_party="V2",
            status=EvidenceRequestStatus.PENDING,
        )
    )

    response = client.post(f"/api/incidents/{incident.id}/evidence-requests/{req.id}/dismiss")
    assert response.status_code == 200
    assert response.json()["status"] == EvidenceRequestStatus.DISMISSED.value

    # Verify persistence
    updated = get_evidence_request(req.id)
    assert updated.status == EvidenceRequestStatus.DISMISSED


def test_get_evidence_and_requests_listing():
    """Verify GET /api/incidents/{id}/evidence and /evidence-requests lists items."""
    incident = create_incident(IncidentCreate(title="Listing Incident"))

    # Add evidence
    files = {"file": ("test.mp4", io.BytesIO(b"data"), "video/mp4")}
    client.post(f"/api/incidents/{incident.id}/evidence", files=files)

    # Add evidence request
    create_evidence_request(
        EvidenceRequestCreate(
            incident_id=incident.id,
            request_type="telematics",
            description="Request airbag deployment data",
        )
    )

    # List evidence
    ev_resp = client.get(f"/api/incidents/{incident.id}/evidence")
    assert ev_resp.status_code == 200
    assert len(ev_resp.json()) == 1

    # List evidence requests
    req_resp = client.get(f"/api/incidents/{incident.id}/evidence-requests")
    assert req_resp.status_code == 200
    assert len(req_resp.json()) == 1
    assert req_resp.json()[0]["request_type"] == "telematics"
