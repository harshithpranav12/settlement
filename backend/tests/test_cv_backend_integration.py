"""Integration tests for Computer Vision module and FastAPI backend."""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import (
    create_evidence,
    create_incident,
    create_party,
    get_evidence,
    list_events_for_incident,
    list_analysis_runs_for_incident,
)
from app.main import app
from app.models import (
    EvidenceCreate,
    EvidenceType,
    IncidentCreate,
    PartyCreate,
    PartyLabel,
    ProcessingStatus,
    VideoAnalysisPayload,
)

client = TestClient(app)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SAMPLE_VIDEO_PATH = _PROJECT_ROOT / "computer_vision" / "sample_videos" / "car_traffic.mp4"
SAMPLE_JSON_PATH = _PROJECT_ROOT / "computer_vision" / "outputs" / "car_traffic_analysis.json"


def test_ingest_actual_car_traffic_cv_json():
    """Ingest real CV pipeline output from car_traffic_analysis.json and verify database events and timeline."""
    assert SAMPLE_JSON_PATH.exists(), f"Sample CV JSON not found at {SAMPLE_JSON_PATH}"
    with open(SAMPLE_JSON_PATH, "r", encoding="utf-8") as f:
        cv_data = json.load(f)

    # 1. Create incident and register video evidence
    incident = create_incident(IncidentCreate(title="Car Traffic Intersection Analysis"))
    evidence = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.DASHCAM_VIDEO,
            original_filename="car_traffic.mp4",
            storage_reference=str(SAMPLE_VIDEO_PATH),
            processing_status=ProcessingStatus.UPLOADED,
        )
    )

    # 2. Ingest via HTTP POST /incidents/{incident_id}/evidence/{evidence_id}/cv-detections
    response = client.post(
        f"/api/incidents/{incident.id}/evidence/{evidence.id}/cv-detections",
        json=cv_data,
    )
    assert response.status_code == 200, response.text
    res_data = response.json()

    # 3. Verify top-level structure and counts
    assert res_data["incident_id"] == incident.id
    assert res_data["source_id"] == evidence.id
    assert res_data["video_fps"] == 12.5
    assert res_data["frame_width"] == 768
    assert res_data["frame_height"] == 432
    assert res_data["total_detections"] == 47
    assert res_data["tracked_vehicles_count"] == 7
    assert len(res_data["vehicle_tracks"]) == 7
    assert len(res_data["possible_interactions"]) == 1
    assert "disclaimer" in res_data
    assert "Legal and forensic disclaimer" in res_data["disclaimer"] or "machine-vision observations" in res_data["disclaimer"]

    # 4. Verify vehicle tracking and trajectories
    vehicle_ids = {t["vehicle_id"] for t in res_data["vehicle_tracks"]}
    assert {"1", "5", "8", "10", "11"}.issubset(vehicle_ids)

    # Check vehicle 1 trajectory
    v1_track = next(t for t in res_data["vehicle_tracks"] if t["vehicle_id"] == "1")
    assert v1_track["detected_class"] == "car"
    assert len(v1_track["trajectory"]) > 0
    assert v1_track["first_frame"] == 62
    assert v1_track["last_frame"] == 68

    # 5. Verify interaction event (vehicle 8 and 10 convergence)
    inter = res_data["possible_interactions"][0]
    assert inter["finding"] == "path_convergence"
    assert set(inter["vehicle_ids"]) == {"8", "10"}
    assert inter["timestamp_seconds"] == 18.4
    assert inter["min_image_distance_pixels"] == 1.08

    # 6. Verify SQLite database events
    db_events = list_events_for_incident(incident.id)
    event_types = {e.event_type for e in db_events}
    assert "visual_object_trajectory" in event_types
    assert "visual_trajectory_interaction" in event_types

    # 7. Verify incident timeline includes CV events
    timeline_res = client.get(f"/api/incidents/{incident.id}/timeline")
    assert timeline_res.status_code == 200
    timeline_data = timeline_res.json()
    assert timeline_data["total_events"] >= 8

    # 8. Verify analysis run created
    runs = list_analysis_runs_for_incident(incident.id)
    assert any(r.run_type == "video_analysis" for r in runs)


def test_analyze_video_evidence_endpoint_execution(tmp_path):
    """Test POST /incidents/{incident_id}/evidence/{evidence_id}/analyze-video with real video."""
    if not SAMPLE_VIDEO_PATH.exists():
        pytest.skip("Sample video car_traffic.mp4 not found")

    incident = create_incident(IncidentCreate(title="End-to-End CV Pipeline Test"))

    # Register evidence pointing to the sample video
    evidence = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.DASHCAM_VIDEO,
            original_filename="car_traffic.mp4",
            storage_reference=str(SAMPLE_VIDEO_PATH),
            processing_status=ProcessingStatus.UPLOADED,
        )
    )

    # Call endpoint to trigger pipeline
    response = client.post(
        f"/api/incidents/{incident.id}/evidence/{evidence.id}/analyze-video"
    )
    assert response.status_code == 200, response.text
    result = response.json()

    assert result["incident_id"] == incident.id
    assert result["source_id"] == evidence.id
    assert result["tracked_vehicles_count"] == 7
    assert result["total_detections"] == 47
    assert len(result["possible_interactions"]) == 1
    assert "artifacts" in result
    assert result["artifacts"]["json_path"] is not None
    assert result["artifacts"]["trajectory_plot_path"] is not None
    assert Path(result["artifacts"]["json_path"]).exists()
    assert Path(result["artifacts"]["trajectory_plot_path"]).exists()


def test_upload_and_analyze_video_endpoint(tmp_path):
    """Test POST /incidents/{incident_id}/analyze-video multipart upload & analyze in one step."""
    if not SAMPLE_VIDEO_PATH.exists():
        pytest.skip("Sample video car_traffic.mp4 not found")

    incident = create_incident(IncidentCreate(title="One-Step Video Upload & Analysis Test"))
    party = create_party(incident_id=incident.id, data=PartyCreate(party_label=PartyLabel.V1, name="Driver 1", vehicle_registration="ABC-1234"))

    with open(SAMPLE_VIDEO_PATH, "rb") as video_file:
        response = client.post(
            f"/api/incidents/{incident.id}/analyze-video",
            files={"file": ("car_traffic.mp4", video_file, "video/mp4")},
            data={"party_id": party.id},
        )

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["incident_id"] == incident.id
    assert result["tracked_vehicles_count"] == 7
    assert result["total_detections"] == 47


def test_video_analysis_error_handling():
    """Verify clean 400 and 404 error handling for invalid or missing resources."""
    incident = create_incident(IncidentCreate(title="Error Handling Test"))

    # Non-existent evidence
    res = client.post(f"/api/incidents/{incident.id}/evidence/non_existent_id/analyze-video")
    assert res.status_code == 404
    err_msg = res.json().get("error", "") or res.json().get("detail", "")
    assert "not found" in str(err_msg).lower()

    # Non-video evidence type
    csv_evidence = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.TELEMATICS,
            original_filename="sensor.csv",
            storage_reference="sensor.csv",
            processing_status=ProcessingStatus.UPLOADED,
        )
    )
    res = client.post(f"/api/incidents/{incident.id}/evidence/{csv_evidence.id}/analyze-video")
    assert res.status_code == 400
    err_msg = res.json().get("error", "") or res.json().get("detail", "")
    assert "does not appear to be an uploaded video" in str(err_msg).lower()
