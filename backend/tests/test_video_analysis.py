"""Unit tests for video analysis service and computer-vision module integration."""

import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import (
    create_evidence,
    create_incident,
    get_evidence,
    list_analysis_runs_for_incident,
    list_events_for_incident,
)
from app.main import app
from app.models import (
    EvidenceCreate,
    EvidenceType,
    IncidentCreate,
    ProcessingStatus,
    VideoAnalysisPayload,
)
from app.services.video_analysis import process_detection_results

client = TestClient(app)


def _setup_video_evidence(incident_title: str = "Dashcam Crash Investigation"):
    """Helper to create an incident and register an uploaded video evidence item."""
    incident = create_incident(IncidentCreate(title=incident_title))

    # Create dummy video evidence on disk
    video_dir = Path(settings.UPLOAD_DIR) / "incidents" / incident.id
    video_dir.mkdir(parents=True, exist_ok=True)
    video_file = video_dir / "front_dashcam_test.mp4"
    video_file.write_bytes(b"dummy mp4 video bytes")

    evidence = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.DASHCAM_VIDEO,
            original_filename="front_dashcam_test.mp4",
            storage_reference=str(video_file),
            processing_status=ProcessingStatus.UPLOADED,
        )
    )
    return incident, evidence


# ============================================================================
# 1. VALID CV INGESTION & TRAJECTORY GENERATION
# ============================================================================

def test_ingest_valid_cv_detections():
    """Verify ingestion of valid detections generates trajectories, observation events, and disclaimer."""
    incident, evidence = _setup_video_evidence()

    cv_payload = {
        "source_id": evidence.id,
        "video_fps": 30.0,
        "frame_width": 1920,
        "frame_height": 1080,
        "detections": [
            # Track trk_1 detections over frames 0, 15, 30
            {
                "vehicle_id": "trk_1",
                "class": "car",
                "timestamp_seconds": 0.0,
                "frame_number": 0,
                "bbox": {"x_min": 100.0, "y_min": 200.0, "x_max": 300.0, "y_max": 400.0},
                "confidence": 0.95,
            },
            {
                "vehicle_id": "trk_1",
                "class": "car",
                "timestamp_seconds": 0.5,
                "frame_number": 15,
                "bbox": {"x_min": 150.0, "y_min": 210.0, "x_max": 350.0, "y_max": 410.0},
                "confidence": 0.93,
            },
            {
                "vehicle_id": "trk_1",
                "class": "car",
                "timestamp_seconds": 1.0,
                "frame_number": 30,
                "bbox": {"x_min": 200.0, "y_min": 220.0, "x_max": 400.0, "y_max": 420.0},
                "confidence": 0.91,
            },
            # Track trk_2 detection over frames 15, 30
            {
                "vehicle_id": "trk_2",
                "class": "truck",
                "timestamp_seconds": 0.5,
                "frame_number": 15,
                "bbox": {"x_min": 800.0, "y_min": 300.0, "x_max": 1100.0, "y_max": 650.0},
                "confidence": 0.88,
            },
            {
                "vehicle_id": "trk_2",
                "class": "truck",
                "timestamp_seconds": 1.0,
                "frame_number": 30,
                "bbox": {"x_min": 820.0, "y_min": 305.0, "x_max": 1120.0, "y_max": 655.0},
                "confidence": 0.89,
            },
        ],
    }

    response = client.post(
        f"/api/incidents/{incident.id}/cv-detections",
        json=cv_payload,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["incident_id"] == incident.id
    assert data["source_id"] == evidence.id
    assert data["total_detections"] == 5
    assert data["tracked_vehicles_count"] == 2

    # Check vehicle tracks
    tracks = {t["vehicle_id"]: t for t in data["vehicle_tracks"]}
    assert "trk_1" in tracks
    assert "trk_2" in tracks

    # Check trajectory points for trk_1
    trk1 = tracks["trk_1"]
    assert trk1["detected_class"] == "car"
    assert trk1["detection_count"] == 3
    assert trk1["first_frame"] == 0
    assert trk1["last_frame"] == 30
    assert trk1["duration_seconds"] == 1.0
    assert "algorithm_track" in trk1["tracking_label"]

    pts = trk1["trajectory"]
    assert len(pts) == 3
    # Check pixel center calculations: (100 + 300)/2 = 200, (200 + 400)/2 = 300
    assert pts[0]["center_pixel_x"] == 200.0
    assert pts[0]["center_pixel_y"] == 300.0
    assert pts[0]["bbox_width_pixels"] == 200.0
    assert pts[0]["bbox_height_pixels"] == 200.0

    # Requirement 8 & Legal Disclaimer: does not assert speed, fault, or collision
    assert "does not establish calibrated speed, fault, collision, or legal responsibility" in data["disclaimer"]

    # Verify SQLite observation events created
    events = list_events_for_incident(incident.id)
    cv_events = [e for e in events if e.event_type == "visual_object_trajectory"]
    assert len(cv_events) == 2
    assert all(e.classification.value == "observation" for e in cv_events)
    assert all(e.evidence_references == [evidence.id] for e in cv_events)

    # Verify analysis run recorded
    runs = list_analysis_runs_for_incident(incident.id)
    assert any(r.run_type == "video_analysis" for r in runs)

    # Verify evidence status updated to completed
    updated_ev = get_evidence(evidence.id)
    assert updated_ev.processing_status == ProcessingStatus.COMPLETED


def test_alternative_bbox_formats():
    """Verify bounding box coordinates can be passed as a 4-item list or alternate dict keys."""
    incident, evidence = _setup_video_evidence("Alternate Format Incident")

    # 1. Test 4-item list [x_min, y_min, x_max, y_max]
    payload_list_bbox = {
        "source_id": evidence.id,
        "video_fps": 25.0,
        "frame_width": 1280,
        "frame_height": 720,
        "detections": [
            {
                "vehicle_id": "veh_list",
                "class": "bus",
                "timestamp_seconds": 1.2,
                "frame_number": 30,
                "bbox": [100.0, 150.0, 400.0, 350.0],  # List format
                "confidence": 0.85,
            }
        ],
    }
    resp = client.post(f"/api/incidents/{incident.id}/cv-detections", json=payload_list_bbox)
    assert resp.status_code == 200
    assert resp.json()["vehicle_tracks"][0]["trajectory"][0]["center_pixel_x"] == 250.0

    # 2. Test dictionary with xmin/ymin/xmax/ymax
    payload_alt_keys = {
        "source_id": evidence.id,
        "video_fps": 25.0,
        "frame_width": 1280,
        "frame_height": 720,
        "detections": [
            {
                "vehicle_id": "veh_alt",
                "class": "motorcycle",
                "timestamp_seconds": 2.0,
                "frame_number": 50,
                "bbox": {"xmin": 50, "ymin": 60, "xmax": 150, "ymax": 180},
                "confidence": 0.90,
            }
        ],
    }
    resp2 = client.post(f"/api/incidents/{incident.id}/cv-detections", json=payload_alt_keys)
    assert resp2.status_code == 200


def test_direct_python_callable_function():
    """Verify computer-vision teammate can invoke process_detection_results directly in Python."""
    incident, evidence = _setup_video_evidence("Python Integration Test")

    raw_dict = {
        "source_id": evidence.id,
        "video_fps": 30.0,
        "frame_width": 1920,
        "frame_height": 1080,
        "detections": [
            {
                "vehicle_id": "trk_py",
                "class": "car",
                "timestamp_seconds": 0.1,
                "frame_number": 3,
                "bbox": [50.0, 50.0, 150.0, 150.0],
                "confidence": 0.99,
            }
        ],
    }

    result = process_detection_results(incident_id=incident.id, detection_data=raw_dict)
    assert result.total_detections == 1
    assert result.vehicle_tracks[0].vehicle_id == "trk_py"


# ============================================================================
# 2. VALIDATION & ERROR HANDLING
# ============================================================================

def test_reject_inverted_bounding_box():
    """Verify inverted bounding boxes (x_min >= x_max or y_min >= y_max) are rejected."""
    incident, evidence = _setup_video_evidence()

    # x_min (300) > x_max (100)
    invalid_payload = {
        "source_id": evidence.id,
        "video_fps": 30.0,
        "frame_width": 1920,
        "frame_height": 1080,
        "detections": [
            {
                "vehicle_id": "trk_err",
                "class": "car",
                "timestamp_seconds": 0.0,
                "frame_number": 0,
                "bbox": [300.0, 100.0, 100.0, 200.0],
                "confidence": 0.9,
            }
        ],
    }

    response = client.post(f"/api/incidents/{incident.id}/cv-detections", json=invalid_payload)
    assert response.status_code == 422
    assert "strictly less than x_max" in str(response.json()["detail"])


def test_reject_bounding_box_out_of_frame_boundaries():
    """Verify bounding boxes exceeding frame_width or frame_height are rejected."""
    incident, evidence = _setup_video_evidence()

    # x_max (2100) exceeds frame_width (1920)
    out_of_bounds_payload = {
        "source_id": evidence.id,
        "video_fps": 30.0,
        "frame_width": 1920,
        "frame_height": 1080,
        "detections": [
            {
                "vehicle_id": "trk_out",
                "class": "car",
                "timestamp_seconds": 0.0,
                "frame_number": 0,
                "bbox": [1800.0, 100.0, 2100.0, 300.0],
                "confidence": 0.85,
            }
        ],
    }

    response = client.post(f"/api/incidents/{incident.id}/cv-detections", json=out_of_bounds_payload)
    assert response.status_code == 422
    assert "exceeds frame_width" in str(response.json()["detail"])


def test_reject_negative_timestamp():
    """Verify negative timestamp values are rejected with 422 Unprocessable Entity."""
    incident, evidence = _setup_video_evidence()

    neg_time_payload = {
        "source_id": evidence.id,
        "video_fps": 30.0,
        "frame_width": 1920,
        "frame_height": 1080,
        "detections": [
            {
                "vehicle_id": "trk_neg",
                "class": "car",
                "timestamp_seconds": -0.5,  # Invalid
                "frame_number": 0,
                "bbox": [10.0, 10.0, 50.0, 50.0],
                "confidence": 0.9,
            }
        ],
    }

    response = client.post(f"/api/incidents/{incident.id}/cv-detections", json=neg_time_payload)
    assert response.status_code == 422


def test_reject_invalid_confidence():
    """Verify confidence values outside 0.0 to 1.0 are rejected."""
    incident, evidence = _setup_video_evidence()

    conf_payload = {
        "source_id": evidence.id,
        "video_fps": 30.0,
        "frame_width": 1920,
        "frame_height": 1080,
        "detections": [
            {
                "vehicle_id": "trk_conf",
                "class": "car",
                "timestamp_seconds": 1.0,
                "frame_number": 30,
                "bbox": [10.0, 10.0, 50.0, 50.0],
                "confidence": 1.25,  # Invalid > 1.0
            }
        ],
    }

    response = client.post(f"/api/incidents/{incident.id}/cv-detections", json=conf_payload)
    assert response.status_code == 422


def test_reject_non_existent_source_evidence():
    """Verify non-existent source_id returns 404 Not Found."""
    incident = create_incident(IncidentCreate(title="Missing Evidence Test"))

    payload = {
        "source_id": "00000000-0000-0000-0000-000000000000",
        "video_fps": 30.0,
        "frame_width": 1920,
        "frame_height": 1080,
        "detections": [],
    }

    response = client.post(f"/api/incidents/{incident.id}/cv-detections", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["error"].lower()


def test_reject_non_video_evidence_source():
    """Verify attempting to attach video detections to a non-video evidence item returns 400."""
    incident = create_incident(IncidentCreate(title="PDF Evidence Incident"))

    # Register police report PDF evidence
    pdf_ev = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.POLICE_REPORT,
            original_filename="police_report.pdf",
            storage_reference="data/uploads/police_report.pdf",
            processing_status=ProcessingStatus.UPLOADED,
        )
    )

    payload = {
        "source_id": pdf_ev.id,
        "video_fps": 30.0,
        "frame_width": 1920,
        "frame_height": 1080,
        "detections": [],
    }

    response = client.post(f"/api/incidents/{incident.id}/cv-detections", json=payload)
    assert response.status_code == 400
    assert "does not appear to be an uploaded video" in response.json()["error"].lower()


# ============================================================================
# 3. CV PHYSICS & MOTION REASONING INTEGRATION (TEAMMATE EXPANDED CONTRACT)
# ============================================================================

def test_cv_physics_and_motion_reasoning_payload():
    """Verify full ingestion of teammate's expanded contract with physics & motion analysis."""
    incident = create_incident(IncidentCreate(title="Physics CV Ingestion Test"))

    # Register video evidence with original_filename "VID001.mp4"
    video_dir = Path(settings.UPLOAD_DIR) / "incidents" / incident.id
    video_dir.mkdir(parents=True, exist_ok=True)
    video_path = video_dir / "VID001.mp4"
    video_path.write_bytes(b"dummy video bytes")

    evidence = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.DASHCAM_VIDEO,
            original_filename="VID001.mp4",
            storage_reference=str(video_path),
            processing_status=ProcessingStatus.UPLOADED,
        )
    )

    # Teammate's exact JSON payload with physics reasoning
    payload = {
        "source_id": evidence.id,
        "video_fps": 30.0,
        "frame_width": 1280,
        "frame_height": 720,
        "detections": [
            {
                "vehicle_id": "TRACK_1",
                "class": "car",
                "timestamp_seconds": 10.5,
                "frame_number": 315,
                "bbox": {
                    "x": 100,
                    "y": 150,
                    "width": 200,
                    "height": 120,
                },
                "confidence": 0.91,
            }
        ],
        "trajectories": [
            {
                "vehicle_id": "TRACK_1",
                "points": [
                    {
                        "timestamp_seconds": 10.5,
                        "frame_number": 315,
                        "center_x": 200,
                        "center_y": 210,
                    },
                    {
                        "timestamp_seconds": 10.53,
                        "frame_number": 316,
                        "center_x": 208,
                        "center_y": 214,
                    },
                ],
            }
        ],
        "motion_analysis": [
            {
                "vehicle_id": "TRACK_1",
                "velocity_trend": "increasing",
                "acceleration_trend": "positive",
                "velocity_unit": "pixels_per_second",
                "acceleration_unit": "pixels_per_second_squared",
                "sudden_motion_change": False,
                "analysis_notes": "Vehicle shows increasing image-plane movement.",
            }
        ],
        "possible_interactions": [
            {
                "vehicle_ids": ["TRACK_1", "TRACK_2"],
                "timestamp_seconds": 10.8,
                "finding": "possible_path_convergence",
                "min_image_distance_pixels": 35.0,
                "evidence_frame_numbers": [324, 325, 326],
                "confidence": 0.72,
            }
        ],
    }

    response = client.post(
        f"/api/incidents/{incident.id}/cv-detections",
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["incident_id"] == incident.id
    assert data["source_id"] == evidence.id
    assert data["video_fps"] == 30.0
    assert data["frame_width"] == 1280
    assert data["frame_height"] == 720
    assert data["total_detections"] == 1
    assert data["tracked_vehicles_count"] == 1

    # Check vehicle track & trajectory points
    trk = data["vehicle_tracks"][0]
    assert trk["vehicle_id"] == "TRACK_1"
    assert trk["detected_class"] == "car"
    assert trk["tracking_label"] == "algorithm_track_TRACK_1_unverified_identity"
    assert len(trk["trajectory"]) == 2
    assert trk["trajectory"][0]["frame_number"] == 315
    assert trk["trajectory"][0]["center_pixel_x"] == 200.0
    assert trk["trajectory"][0]["center_pixel_y"] == 210.0
    assert trk["trajectory"][0]["bbox_width_pixels"] == 200.0
    assert trk["trajectory"][0]["bbox_height_pixels"] == 120.0
    assert trk["trajectory"][1]["frame_number"] == 316
    assert trk["trajectory"][1]["center_pixel_x"] == 208.0
    assert trk["trajectory"][1]["center_pixel_y"] == 214.0

    # Check motion summary attached to vehicle track
    assert trk["motion_summary"] is not None
    assert trk["motion_summary"]["velocity_trend"] == "increasing"
    assert trk["motion_summary"]["acceleration_trend"] == "positive"
    assert trk["motion_summary"]["analysis_notes"] == "Vehicle shows increasing image-plane movement."

    # Check root motion analysis and interactions in response
    assert len(data["motion_analysis"]) == 1
    assert data["motion_analysis"][0]["vehicle_id"] == "TRACK_1"
    assert len(data["possible_interactions"]) == 1
    interaction = data["possible_interactions"][0]
    assert interaction["vehicle_ids"] == ["TRACK_1", "TRACK_2"]
    assert interaction["finding"] == "possible_path_convergence"
    assert interaction["min_image_distance_pixels"] == 35.0
    assert interaction["evidence_frame_numbers"] == [324, 325, 326]

    # Verify SQLite observation events
    events = list_events_for_incident(incident.id)
    traj_events = [e for e in events if e.event_type == "visual_object_trajectory"]
    assert len(traj_events) == 1
    assert traj_events[0].metadata["trajectory_points_count"] == 2
    assert traj_events[0].metadata["velocity_trend"] == "increasing"

    interaction_events = [e for e in events if e.event_type == "visual_trajectory_interaction"]
    assert len(interaction_events) == 1
    assert interaction_events[0].metadata["finding"] == "possible_path_convergence"
    assert interaction_events[0].metadata["min_image_distance_pixels"] == 35.0
    assert interaction_events[0].metadata["is_physical_contact_proven"] is False
    assert "2D image-plane proximity does not prove physical contact" in interaction_events[0].description


def test_sudden_motion_change_event_creation():
    """Verify sudden motion changes generate normalized observation events in SQLite."""
    incident, evidence = _setup_video_evidence("Sudden Decel Test")

    payload = {
        "source_id": evidence.id,
        "video_fps": 30.0,
        "frame_width": 1280,
        "frame_height": 720,
        "detections": [
            {
                "vehicle_id": "TRACK_A",
                "class": "car",
                "timestamp_seconds": 5.0,
                "frame_number": 150,
                "bbox": {"x": 200, "y": 300, "width": 100, "height": 80},
                "confidence": 0.95,
            }
        ],
        "motion_analysis": [
            {
                "vehicle_id": "TRACK_A",
                "velocity_trend": "decreasing",
                "acceleration_trend": "negative",
                "velocity_unit": "pixels_per_second",
                "acceleration_unit": "pixels_per_second_squared",
                "sudden_motion_change": True,
                "analysis_notes": "Sharp deceleration detected in image coordinates.",
            }
        ],
    }

    resp = client.post(f"/api/incidents/{incident.id}/cv-detections", json=payload)
    assert resp.status_code == 200

    events = list_events_for_incident(incident.id)
    motion_events = [e for e in events if e.event_type == "sudden_visual_motion_change"]
    assert len(motion_events) == 1
    assert motion_events[0].classification.value == "observation"
    assert "Sudden 2D image-plane motion change detected" in motion_events[0].description
    assert "do not prove physical acceleration, emergency braking, collision, or fault" in motion_events[0].description


def test_source_id_matching_by_filename_or_stem():
    """Verify source_id matching allows using filename stem (e.g. VID001)."""
    incident = create_incident(IncidentCreate(title="Filename Stem Test"))

    video_dir = Path(settings.UPLOAD_DIR) / "incidents" / incident.id
    video_dir.mkdir(parents=True, exist_ok=True)
    video_path = video_dir / "VID001.mp4"
    video_path.write_bytes(b"dummy")

    evidence = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.DASHCAM_VIDEO,
            original_filename="VID001.mp4",
            storage_reference=str(video_path),
            processing_status=ProcessingStatus.UPLOADED,
        )
    )

    # Calling with stem "VID001" instead of the UUID evidence.id
    payload = {
        "source_id": "VID001",
        "video_fps": 30.0,
        "frame_width": 1280,
        "frame_height": 720,
        "detections": [
            {
                "vehicle_id": "TRACK_STEM",
                "class": "car",
                "timestamp_seconds": 1.0,
                "frame_number": 30,
                "bbox": {"x": 50, "y": 50, "width": 80, "height": 60},
                "confidence": 0.88,
            }
        ],
    }

    resp = client.post(f"/api/incidents/{incident.id}/cv-detections", json=payload)
    assert resp.status_code == 200
    assert resp.json()["source_id"] == "VID001"


def test_video_llm_analysis_synthesis():
    """Verify video analysis executes LLM forensic synthesis with grounded narrative."""
    incident, evidence = _setup_video_evidence()

    payload = {
        "source_id": evidence.id,
        "video_fps": 30.0,
        "frame_width": 1280,
        "frame_height": 720,
        "detections": [
            {
                "vehicle_id": "V1",
                "class": "car",
                "timestamp_seconds": 1.0,
                "frame_number": 30,
                "bbox": [100.0, 100.0, 250.0, 220.0],
                "confidence": 0.95,
            },
            {
                "vehicle_id": "V2",
                "class": "truck",
                "timestamp_seconds": 1.0,
                "frame_number": 30,
                "bbox": [300.0, 100.0, 480.0, 250.0],
                "confidence": 0.92,
            },
        ],
        "possible_interactions": [
            {
                "vehicle_ids": ["V1", "V2"],
                "timestamp_seconds": 1.2,
                "finding": "path_convergence",
                "min_image_distance_pixels": 45.0,
                "evidence_frame_numbers": [36],
                "confidence": 0.88,
            }
        ],
    }

    res = client.post(f"/api/incidents/{incident.id}/cv-detections", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "llm_analysis" in data
    assert data["llm_analysis"] is not None
    llm = data["llm_analysis"]
    assert "narrative_synthesis" in llm
    assert len(llm["narrative_synthesis"]) > 20
    assert "observable_timeline" in llm
    assert len(llm["observable_timeline"]) >= 2
    assert "interaction_assessment" in llm
    assert "forensic_unknowns" in llm
    assert len(llm["forensic_unknowns"]) >= 2
    assert "liability_disclaimer" in llm
    assert "liability" in llm["liability_disclaimer"].lower()


