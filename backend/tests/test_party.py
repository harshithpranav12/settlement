import sqlite3
import pytest
from pydantic import ValidationError

from app.database import (
    create_incident,
    create_party,
    get_party,
    list_parties_for_incident,
)
from app.models import IncidentCreate, PartyCreate, PartyLabel


def test_party_creation_and_retrieval():
    """Verify party V1 and V2 can be created and retrieved for an incident."""
    incident = create_incident(IncidentCreate(title="Two Vehicle Collision"))

    # Create V1
    party_v1 = create_party(
        incident_id=incident.id,
        data=PartyCreate(
            party_label=PartyLabel.V1,
            name="Driver Alpha",
            vehicle_registration="KA-05-MJ-4321",
            statement="V2 failed to yield while turning right.",
        ),
    )
    assert party_v1.id is not None
    assert party_v1.party_label == PartyLabel.V1
    assert party_v1.name == "Driver Alpha"

    # Create V2
    party_v2 = create_party(
        incident_id=incident.id,
        data=PartyCreate(
            party_label=PartyLabel.V2,
            name="Driver Beta",
            vehicle_registration="KA-01-AB-1111",
            statement="V1 was exceeding speed limit.",
        ),
    )
    assert party_v2.id is not None
    assert party_v2.party_label == PartyLabel.V2

    # List parties for incident
    parties = list_parties_for_incident(incident.id)
    assert len(parties) == 2
    assert parties[0].party_label == PartyLabel.V1
    assert parties[1].party_label == PartyLabel.V2


def test_party_label_validation_pydantic():
    """Verify Pydantic rejects party labels other than V1 or V2."""
    with pytest.raises(ValidationError):
        PartyCreate(
            party_label="V3",  # Invalid
            name="Driver Gamma",
            vehicle_registration="KA-03-XY-9999",
            statement="Invalid party label",
        )

    with pytest.raises(ValidationError):
        PartyCreate(
            party_label="Witness",  # Invalid
            name="Witness John",
            vehicle_registration="None",
        )


def test_party_duplicate_label_constraint():
    """Verify that an incident cannot register multiple V1 parties (unique constraint)."""
    incident = create_incident(IncidentCreate(title="Crash with Duplicate Party Attempt"))

    create_party(
        incident_id=incident.id,
        data=PartyCreate(
            party_label=PartyLabel.V1,
            name="First Driver V1",
            vehicle_registration="REG-1",
        ),
    )

    # Attempting to insert a second V1 for the same incident should violate UNIQUE(incident_id, party_label)
    with pytest.raises(sqlite3.IntegrityError):
        create_party(
            incident_id=incident.id,
            data=PartyCreate(
                party_label=PartyLabel.V1,
                name="Second Driver V1",
                vehicle_registration="REG-2",
            ),
        )
