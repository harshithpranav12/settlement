from datetime import datetime, timezone
import pytest
from app.database import (
    create_analysis_run,
    create_incident,
    create_party,
    delete_incident,
    get_incident,
    get_incident_detail,
    list_incidents,
    update_incident,
)
from app.models import (
    AnalysisRunCreate,
    AnalysisRunStatus,
    IncidentCreate,
    IncidentStatus,
    IncidentUpdate,
    PartyCreate,
    PartyLabel,
)


def test_create_and_read_incident():
    """Verify incident creation and retrieval with unique ID, status, and UTC timestamp."""
    data = IncidentCreate(
        title="Intersection Collision: 5th Ave and Main St",
        location="5th Ave & Main St, Springfield",
        status=IncidentStatus.CREATED,
    )
    incident = create_incident(data)

    assert incident.id is not None
    assert incident.title == "Intersection Collision: 5th Ave and Main St"
    assert incident.location == "5th Ave & Main St, Springfield"
    assert incident.status == IncidentStatus.CREATED
    assert isinstance(incident.created_at, datetime)
    assert incident.created_at.tzinfo is not None

    # Retrieve by ID
    retrieved = get_incident(incident.id)
    assert retrieved is not None
    assert retrieved.id == incident.id
    assert retrieved.title == incident.title


def test_incident_update_and_listing():
    """Verify updating incident status and listing all incidents."""
    inc1 = create_incident(IncidentCreate(title="Accident Alpha"))
    inc2 = create_incident(IncidentCreate(title="Accident Beta"))

    all_incidents = list_incidents()
    assert len(all_incidents) >= 2
    incident_ids = [inc.id for inc in all_incidents]
    assert inc1.id in incident_ids
    assert inc2.id in incident_ids

    # Update status
    updated = update_incident(inc1.id, IncidentUpdate(status=IncidentStatus.ANALYZING))
    assert updated is not None
    assert updated.status == IncidentStatus.ANALYZING


def test_incident_analysis_history():
    """Verify incident maintains its analysis history over multiple runs."""
    inc = create_incident(IncidentCreate(title="Crash with Analysis Run"))

    # Register first run
    run1 = create_analysis_run(
        AnalysisRunCreate(
            incident_id=inc.id,
            run_type="timeline_reconstruction",
            status=AnalysisRunStatus.COMPLETED,
            summary="Initial timeline established from dashcam.",
            findings={"key_events_found": 3},
        )
    )

    # Register second run
    run2 = create_analysis_run(
        AnalysisRunCreate(
            incident_id=inc.id,
            run_type="contradiction_detection",
            status=AnalysisRunStatus.COMPLETED,
            summary="Detected speed claim contradiction.",
            findings={"contradictions_found": 1},
        )
    )

    # Add a party
    create_party(
        incident_id=inc.id,
        data=PartyCreate(
            party_label=PartyLabel.V1,
            name="Alice Smith",
            vehicle_registration="NY-987-XYZ",
            statement="I was stopped at a red light.",
        ),
    )

    # Fetch incident detail with analysis history
    detail = get_incident_detail(inc.id)
    assert detail is not None
    assert len(detail.analysis_history) == 2
    assert detail.analysis_history[0].id == run1.id
    assert detail.analysis_history[1].id == run2.id
    assert len(detail.parties) == 1
    assert detail.parties[0].party_label == PartyLabel.V1
