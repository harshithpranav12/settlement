from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from app.database import (
    create_contradiction,
    create_evidence_request,
    create_event,
    create_incident,
    get_contradiction,
    get_evidence_request,
    get_event,
    list_contradictions_for_incident,
    list_events_for_incident,
)
from app.models import (
    ContradictionCreate,
    ContradictionSeverity,
    ContradictionStatus,
    EventClassification,
    EvidenceRequestCreate,
    EvidenceRequestStatus,
    ExtractedEventCreate,
    IncidentCreate,
)


def test_extracted_event_with_wall_clock_and_video_offsets():
    """Verify extracted event separates wall-clock UTC timestamps from video offsets."""
    incident = create_incident(IncidentCreate(title="Crash with Multi-modal Timestamps"))

    wall_clock = datetime(2026, 10, 30, 14, 23, 10, tzinfo=timezone.utc)
    wall_clock_end = datetime(2026, 10, 30, 14, 23, 15, tzinfo=timezone.utc)

    event_data = ExtractedEventCreate(
        incident_id=incident.id,
        source_id="evidence-dashcam-01",
        event_type="collision_impact",
        description="V1 front bumper collides with V2 passenger door.",
        classification=EventClassification.OBSERVATION,
        wall_clock_timestamp=wall_clock,
        wall_clock_end_timestamp=wall_clock_end,
        video_offset_seconds=14.5,
        video_end_offset_seconds=19.5,
        evidence_references=["evidence-dashcam-01", "frame_range_435_585"],
        confidence=0.98,
        metadata={"impact_zone": "front_left"},
    )

    event = create_event(event_data)
    assert event.id is not None
    assert event.classification == EventClassification.OBSERVATION
    assert event.wall_clock_timestamp == wall_clock
    assert event.video_offset_seconds == 14.5
    assert event.video_end_offset_seconds == 19.5
    assert "frame_range_435_585" in event.evidence_references


def test_extracted_event_with_unknown_timestamp():
    """Verify that events with unknown timestamps are allowed and handled cleanly."""
    incident = create_incident(IncidentCreate(title="Witness Statement with Unknown Time"))

    event_data = ExtractedEventCreate(
        incident_id=incident.id,
        source_id="party-v2",
        event_type="statement_claim",
        description="V2 claims traffic signal was green upon entering intersection.",
        classification=EventClassification.CLAIM,
        wall_clock_timestamp=None,       # Unknown real-world time
        video_offset_seconds=None,       # Not tied to video offset
        evidence_references=[],
    )

    event = create_event(event_data)
    assert event.id is not None
    assert event.classification == EventClassification.CLAIM
    assert event.wall_clock_timestamp is None
    assert event.video_offset_seconds is None

    retrieved = get_event(event.id)
    assert retrieved is not None
    assert retrieved.wall_clock_timestamp is None
    assert retrieved.video_offset_seconds is None


def test_extracted_event_classification_validation():
    """Verify classification must be observation, claim, or inference."""
    with pytest.raises(ValidationError):
        ExtractedEventCreate(
            incident_id="inc-123",
            event_type="braking",
            description="Vehicle braked suddenly",
            classification="assumption",  # Invalid classification
        )


def test_contradiction_between_claim_and_observation():
    """Verify contradiction links two events with severity and status."""
    incident = create_incident(IncidentCreate(title="Signal Color Dispute"))

    # Claim event
    claim = create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            event_type="signal_status_claim",
            description="V1 claims traffic signal was green.",
            classification=EventClassification.CLAIM,
        )
    )

    # Observation event
    observation = create_event(
        ExtractedEventCreate(
            incident_id=incident.id,
            event_type="signal_status_observation",
            description="CCTV footage at t=14.2s shows signal was red for V1's direction.",
            classification=EventClassification.OBSERVATION,
            video_offset_seconds=14.2,
        )
    )

    contradiction = create_contradiction(
        ContradictionCreate(
            incident_id=incident.id,
            title="Traffic Signal State Discrepancy",
            description="Driver statement directly conflicts with CCTV observation.",
            event_id_a=claim.id,
            event_id_b=observation.id,
            severity=ContradictionSeverity.CRITICAL,
            status=ContradictionStatus.DETECTED,
        )
    )

    assert contradiction.id is not None
    assert contradiction.event_id_a == claim.id
    assert contradiction.event_id_b == observation.id
    assert contradiction.severity == ContradictionSeverity.CRITICAL

    all_contra = list_contradictions_for_incident(incident.id)
    assert len(all_contra) == 1
    assert all_contra[0].id == contradiction.id


def test_evidence_request_creation():
    """Verify evidence request creation and lifecycle fields."""
    incident = create_incident(IncidentCreate(title="Crash with Missing CCTV"))

    req = create_evidence_request(
        EvidenceRequestCreate(
            incident_id=incident.id,
            request_type="cctv_footage",
            description="Request City Traffic Camera #42 for interval 14:00 to 14:30 UTC.",
            target_party="City Traffic Department",
            status=EvidenceRequestStatus.PENDING,
        )
    )

    assert req.id is not None
    assert req.target_party == "City Traffic Department"
    assert req.status == EvidenceRequestStatus.PENDING

    retrieved = get_evidence_request(req.id)
    assert retrieved is not None
    assert retrieved.description == req.description
