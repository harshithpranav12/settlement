"""End-to-End User Journey Test for TRACE AI Road Accident Evidence Analysis.

Simulates the full user flow through the FastAPI backend:
1. Create an incident case.
2. Register involved parties (V1 & V2) with driver statements.
3. Upload dashcam / CCTV video evidence and execute the computer vision pipeline.
4. Ingest sensor telemetry CSV and deterministically extract kinematics.
5. Execute automated multi-modal investigation workflow with LLM statement cross-examination.
6. Verify multi-modal timeline reconstruction (video, sensor, claims).
7. Verify contradiction detection and targeted evidence request generation.
8. Verify structured 10-section forensic report generation.
"""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SAMPLE_VIDEO_PATH = _PROJECT_ROOT / "computer_vision" / "sample_videos" / "car_traffic.mp4"
SAMPLE_CSV_CONTENT = """timestamp,vehicle_id,speed_kmh,acceleration_mps2,latitude,longitude,brake_status,throttle_position_pct,data_source
18:42:09.020 UTC,V1,84.5,0.1,37.5402,-77.4361,False,84,CAN_BUS_LOGGER
18:42:09.520 UTC,V1,84.8,0.15,37.5405,-77.4363,False,84,CAN_BUS_LOGGER
18:42:10.020 UTC,V1,83.0,-0.2,37.5409,-77.4366,False,76,CAN_BUS_LOGGER
18:42:10.520 UTC,V1,80.2,-0.75,37.5412,-77.4368,True,0,CAN_BUS_LOGGER
18:42:11.020 UTC,V1,72.4,-1.2,37.5414,-77.4370,True,0,CAN_BUS_LOGGER
18:42:11.220 UTC,V1,58.0,-2.85,37.54155,-77.43715,True,0,CAN_BUS_LOGGER
18:42:12.020 UTC,V1,31.5,-3.2,37.5417,-77.43728,True,0,CAN_BUS_LOGGER
18:42:12.520 UTC,V1,14.8,-1.9,37.5418,-77.43735,True,0,CAN_BUS_LOGGER
18:42:13.020 UTC,V1,4.2,-0.8,37.54185,-77.4374,True,0,CAN_BUS_LOGGER
18:42:14.020 UTC,V1,0.0,0.0,37.54188,-77.43744,True,0,CAN_BUS_LOGGER
"""


def test_complete_trace_ai_e2e_user_journey():
    # -------------------------------------------------------------------------
    # 1. Create Incident
    # -------------------------------------------------------------------------
    create_inc_res = client.post(
        "/api/incidents",
        json={
            "title": "Main & Market Street Intersection Collision Case",
            "location": "Market St & 4th Ave Intersection",
            "weather": "Overcast / Wet Pavement / 14°C",
            "lead_investigator": "Lead Investigator Marcus Vance",
            "status": "created",
        },
    )
    assert create_inc_res.status_code == 201, create_inc_res.text
    incident = create_inc_res.json()
    incident_id = incident["id"]
    assert incident["title"] == "Main & Market Street Intersection Collision Case"

    # -------------------------------------------------------------------------
    # 2. Register Involved Parties with Statements
    # -------------------------------------------------------------------------
    p1_res = client.post(
        f"/api/incidents/{incident_id}/parties",
        json={
            "party_label": "V1",
            "name": "Alex Mercer (Driver V1)",
            "vehicle_registration": "VA-987-XYZ",
            "statement": "I was travelling northbound on Market Street. The signal was yellow as I entered the crosswalk. I was driving under the 45 mph speed limit, around 25 mph (40 km/h).",
        },
    )
    assert p1_res.status_code == 201, p1_res.text
    p1 = p1_res.json()

    p2_res = client.post(
        f"/api/incidents/{incident_id}/parties",
        json={
            "party_label": "V2",
            "name": "Jordan Hayes (Driver V2)",
            "vehicle_registration": "MD-456-ABC",
            "statement": "I had a protected green left turn arrow. The silver sedan came down the street fast and ran the red light right into my side.",
        },
    )
    assert p2_res.status_code == 201, p2_res.text
    p2 = p2_res.json()

    # -------------------------------------------------------------------------
    # 3. Upload Video Evidence & Run Computer Vision Pipeline
    # -------------------------------------------------------------------------
    assert SAMPLE_VIDEO_PATH.exists(), f"Sample video not found at {SAMPLE_VIDEO_PATH}"
    with open(SAMPLE_VIDEO_PATH, "rb") as vid_file:
        upload_vid_res = client.post(
            f"/api/incidents/{incident_id}/evidence",
            files={"file": ("car_traffic.mp4", vid_file, "video/mp4")},
            data={"evidence_type": "DASHCAM_VIDEO", "party_id": p1["id"]},
        )
    assert upload_vid_res.status_code == 201, upload_vid_res.text
    video_evidence = upload_vid_res.json()
    video_evidence_id = video_evidence["id"]

    # Execute Computer Vision Pipeline
    cv_res = client.post(
        f"/api/incidents/{incident_id}/evidence/{video_evidence_id}/analyze-video"
    )
    assert cv_res.status_code == 200, cv_res.text
    cv_data = cv_res.json()
    assert cv_data["tracked_vehicles_count"] == 7
    assert cv_data["total_detections"] == 47
    assert len(cv_data["possible_interactions"]) >= 1
    assert "artifacts" in cv_data
    assert cv_data["artifacts"]["trajectory_plot_path"] is not None

    # -------------------------------------------------------------------------
    # 4. Ingest Sensor Telemetry CSV & Run Kinematics Analysis
    # -------------------------------------------------------------------------
    upload_csv_res = client.post(
        f"/api/incidents/{incident_id}/evidence",
        files={"file": ("telemetry_v1.csv", SAMPLE_CSV_CONTENT.encode("utf-8"), "text/csv")},
        data={"evidence_type": "TELEMATICS", "party_id": p1["id"]},
    )
    assert upload_csv_res.status_code == 201, upload_csv_res.text
    csv_evidence = upload_csv_res.json()
    csv_evidence_id = csv_evidence["id"]

    # Execute deterministic sensor kinematics analysis
    sensor_res = client.post(
        f"/api/incidents/{incident_id}/evidence/{csv_evidence_id}/analyze-sensor"
    )
    assert sensor_res.status_code == 200, sensor_res.text
    sensor_data = sensor_res.json()
    assert sensor_data["total_rows_read"] == 10
    assert sensor_data["valid_samples_count"] == 10
    assert len(sensor_data["patterns_detected"]) >= 1
    assert len(sensor_data["extracted_event_ids"]) >= 1

    # -------------------------------------------------------------------------
    # 5. Trigger Automated Investigation Workflow (With LLM Statement Analysis)
    # -------------------------------------------------------------------------
    investigate_res = client.post(f"/api/incidents/{incident_id}/investigate")
    assert investigate_res.status_code == 200, investigate_res.text
    investigate_data = investigate_res.json()
    assert investigate_data["status"] in ["ready_for_review", "awaiting_evidence"]
    assert investigate_data["run_count"] >= 1
    assert investigate_data["parties_summary"]["has_v1_statement"] is True
    assert investigate_data["parties_summary"]["has_v2_statement"] is True
    assert investigate_data["evidence_summary"]["total_items"] >= 2

    # -------------------------------------------------------------------------
    # 6. Retrieve Multi-Modal Reconstructed Timeline
    # -------------------------------------------------------------------------
    timeline_res = client.get(f"/api/incidents/{incident_id}/timeline")
    assert timeline_res.status_code == 200, timeline_res.text
    timeline_data = timeline_res.json()
    assert timeline_data["total_events"] > 0
    timeline_items = timeline_data["chronological_timeline"]
    assert len(timeline_items) > 0
    classifications = {item["classification"] for item in timeline_items}
    assert "observation" in classifications or "OBSERVATION" in classifications
    # Verify video events are in timeline
    event_types = {item["event_type"] for item in timeline_items}
    assert any("visual" in et or "trajectory" in et for et in event_types)

    # -------------------------------------------------------------------------
    # 7. Evaluate Factual Contradictions across Claims & Physical Evidence
    # -------------------------------------------------------------------------
    contradictions_res = client.get(f"/api/incidents/{incident_id}/contradictions")
    assert contradictions_res.status_code == 200, contradictions_res.text
    contra_data = contradictions_res.json()
    assert "findings" in contra_data

    # -------------------------------------------------------------------------
    # 8. Generate and Validate 10-Section Structured Forensic Report
    # -------------------------------------------------------------------------
    report_res = client.get(f"/api/incidents/{incident_id}/report")
    assert report_res.status_code == 200, report_res.text
    report = report_res.json()

    assert report["incident_id"] == incident_id
    assert report["incident_summary"] is not None and report["incident_summary"]["id"] == incident_id
    assert len(report["parties"]) == 2
    assert len(report["timeline"]) > 0
    assert len(report["video_observations"]) > 0
    assert len(report["sensor_observations"]) > 0
    assert len(report["evidence_limitations"]) >= 4
    assert report["executive_summary"] is not None and len(report["executive_summary"]) > 20
    assert "disclaimer" in report
    assert "liability" in report["disclaimer"].lower() or "fault" in report["disclaimer"].lower()
