"""Unit and integration tests for the multi-modal timeline engine."""

from datetime import datetime, timezone
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import (
    create_evidence,
    create_event,
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
    ProcessingStatus,
    TimelineResponse,
    TimelineSyncRequest,
    TimelineTimeType,
)
from app.services.timeline_engine import timeline_engine_service

client = TestClient(app)


def test_timeline_sorting_and_separation_of_time_domains():
    """Verify wall-clock UTC events sort chronologically and video offsets remain separate without sync offset."""
    incident = create_incident(IncidentCreate(title="Timeline Time Domain Separation Test"))

    # Register a video evidence item
    vid_path = Path(settings.UPLOAD_DIR) / "incidents" / incident.id / "dashcam.mp4"
    vid_path.parent.mkdir(parents=True, exist_ok=True)
    vid_path.write_bytes(b"dummy")

    ev_video = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.DASHCAM_VIDEO,
            original_filename="dashcam.mp4",
            storage_reference=str(vid_path),
            processing_status=ProcessingStatus.COMPLETED,
        )
    )

    # 1. Wall-clock event 1 at 14:00:05 UTC
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="sensor_v1",
            event_type="speed_measurement",
            description="Vehicle V1 travelling at 45.0 km/h.",
            classification=EventClassification.OBSERVATION,
            wall_clock_timestamp=datetime(2026, 10, 30, 14, 0, 5, 200000, tzinfo=timezone.utc),
            evidence_references=["sensor_csv_01"],
            confidence=1.0,
            metadata={"speed_kmh": 45.0, "vehicle_id": "V1"},
        )
    )

    # 2. Wall-clock event 2 at 14:00:02 UTC (earlier than event 1)
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="sensor_v1",
            event_type="speed_measurement",
            description="Vehicle V1 travelling at 48.0 km/h.",
            classification=EventClassification.OBSERVATION,
            wall_clock_timestamp=datetime(2026, 10, 30, 14, 0, 2, tzinfo=timezone.utc),
            evidence_references=["sensor_csv_01"],
            confidence=1.0,
            metadata={"speed_kmh": 48.0, "vehicle_id": "V1"},
        )
    )

    # 3. Video-relative event at offset 12.5s (no sync offset)
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="cv_track_1",
            event_type="visual_object_trajectory",
            description="Vehicle observed in dashcam footage.",
            classification=EventClassification.OBSERVATION,
            video_offset_seconds=12.5,
            video_end_offset_seconds=15.0,
            evidence_references=[ev_video.id],
            confidence=0.92,
            metadata={"vehicle_id": "V1"},
        )
    )

    # 4. Unanchored claim (unknown timestamp)
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="party_v1",
            event_type="statement_claim",
            description="V1 claims they had right of way at the junction.",
            classification=EventClassification.CLAIM,
            wall_clock_timestamp=None,
            video_offset_seconds=None,
            confidence=0.8,
            metadata={"party_label": "V1"},
        )
    )

    # Fetch timeline via API
    resp = client.get(f"/api/incidents/{incident.id}/timeline")
    assert resp.status_code == 200
    data = resp.json()

    assert data["incident_id"] == incident.id
    assert data["total_events"] == 4
    assert data["synchronized"] is False

    # Check that wall-clock events sorted chronologically (14:00:02 before 14:00:05)
    timeline = data["chronological_timeline"]
    assert timeline[0]["time_type"] == "wall_clock"
    assert "14:00:02" in timeline[0]["display_time"]
    assert timeline[1]["time_type"] == "wall_clock"
    assert "14:00:05" in timeline[1]["display_time"]

    # Check timestamp precision
    assert timeline[1]["time_precision"] == "millisecond"  # has microseconds
    assert timeline[0]["time_precision"] == "second"

    # Check video-relative separation
    assert timeline[2]["time_type"] == "video_relative"
    assert "+12.50s" in timeline[2]["display_time"]
    assert timeline[2]["duration_seconds"] == 2.5
    assert timeline[2]["time_precision"] == "interval"

    # Check unanchored event
    assert timeline[3]["time_type"] == "unanchored"
    assert len(data["unanchored_events"]) == 1
    assert data["unanchored_events"][0]["description"] == "V1 claims they had right of way at the junction."

    # Check video track stream
    assert ev_video.id in data["video_tracks"]
    assert data["video_tracks"][ev_video.id]["items_count"] == 1


def test_timeline_synchronization_with_explicit_offset():
    """Verify video-relative events are projected to real-world UTC when sync offset is supplied."""
    incident = create_incident(IncidentCreate(title="Timeline Sync Test"))

    ev_video = create_evidence(
        EvidenceCreate(
            incident_id=incident.id,
            evidence_type=EvidenceType.CCTV_VIDEO,
            original_filename="junction_cctv.mp4",
            storage_reference="junction_cctv.mp4",
            processing_status=ProcessingStatus.COMPLETED,
        )
    )

    # Video offset at 10.0 seconds
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="cv_track_cctv",
            event_type="visual_object_trajectory",
            description="Vehicle enters junction in CCTV.",
            classification=EventClassification.OBSERVATION,
            video_offset_seconds=10.0,
            evidence_references=[ev_video.id],
            confidence=0.95,
        )
    )

    # Explicit sync offset: video began at 2026-10-30T14:00:00Z
    sync_req = {
        "video_sync_offsets": {
            ev_video.id: "2026-10-30T14:00:00Z",
        },
        "group_occurrences": False,
    }

    resp = client.post(f"/api/incidents/{incident.id}/timeline", json=sync_req)
    assert resp.status_code == 200
    data = resp.json()

    assert data["synchronized"] is True
    assert ev_video.id in data["applied_sync_offsets"]

    # Offset of 10s should yield 2026-10-30T14:00:10Z
    item = data["chronological_timeline"][0]
    assert item["time_type"] == "wall_clock"
    assert item["is_synchronized"] is True
    assert item["sync_offset_applied_seconds"] == 10.0
    assert "2026-10-30 14:00:10" in item["display_time"]


def test_timeline_occurrence_clustering_adequate_evidence_only():
    """Verify multi-source events are clustered into an Occurrence only when adequate supporting info exists."""
    incident = create_incident(IncidentCreate(title="Occurrence Clustering Test"))

    # Event 1: Sensor rapid deceleration for V1 at 14:00:10 UTC
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="sensor_v1",
            event_type="rapid_deceleration",
            description="Rapid deceleration (-6.5 m/s²) recorded for Vehicle V1.",
            classification=EventClassification.OBSERVATION,
            wall_clock_timestamp=datetime(2026, 10, 30, 14, 0, 10, tzinfo=timezone.utc),
            confidence=1.0,
            metadata={"vehicle_id": "V1", "deceleration": -6.5},
        )
    )

    # Event 2: Video visual sudden motion change for V1 at 14:00:10.5 UTC (within 0.5s proximity, same entity)
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="cv_track_V1",
            event_type="sudden_visual_motion_change",
            description="Sudden 2D deceleration observed for V1 in video footage.",
            classification=EventClassification.OBSERVATION,
            wall_clock_timestamp=datetime(2026, 10, 30, 14, 0, 10, 500000, tzinfo=timezone.utc),
            confidence=0.88,
            metadata={"vehicle_id": "V1"},
        )
    )

    # Event 3: Sensor event for completely different vehicle V2 at 14:00:10 UTC (must NOT cluster with V1)
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="sensor_v2",
            event_type="rapid_deceleration",
            description="Rapid deceleration for Vehicle V2.",
            classification=EventClassification.OBSERVATION,
            wall_clock_timestamp=datetime(2026, 10, 30, 14, 0, 10, tzinfo=timezone.utc),
            confidence=1.0,
            metadata={"vehicle_id": "V2"},
        )
    )

    # Event 4: Unanchored claim (must NOT cluster with timed events)
    create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            source_id="v1_party",
            event_type="braking",
            description="Driver claimed they applied emergency brakes.",
            classification=EventClassification.CLAIM,
            wall_clock_timestamp=None,
            metadata={"vehicle_id": "V1"},
        )
    )

    resp = client.get(f"/api/incidents/{incident.id}/timeline?group_occurrences=true")
    assert resp.status_code == 200
    data = resp.json()

    # Verify occurrences
    occurrences = data["occurrences"]
    assert len(occurrences) == 1
    occ = occurrences[0]

    assert "V1" in occ["title"]
    assert occ["supporting_sources_count"] == 2
    assert len(occ["participating_event_ids"]) == 2
    # Verify V2 event was NOT included in V1's occurrence
    assert all("V2" not in s for s in occ["sources"])
