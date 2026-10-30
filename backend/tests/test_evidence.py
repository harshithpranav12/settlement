import sqlite3
from datetime import datetime
from pathlib import Path
import pytest
from app.config import settings
from app.database import (
    create_evidence,
    create_incident,
    create_party,
    get_evidence,
    list_evidence_for_incident,
    update_evidence_status,
)
from app.models import (
    EvidenceCreate,
    EvidenceType,
    IncidentCreate,
    PartyCreate,
    PartyLabel,
    ProcessingStatus,
)


def test_evidence_creation_and_external_file_reference():
    """Verify evidence is stored with external file reference, metadata, and status."""
    incident = create_incident(IncidentCreate(title="Crash with Dashcam Footage"))
    party = create_party(
        incident_id=incident.id,
        data=PartyCreate(
            party_label=PartyLabel.V1,
            name="Alice",
            vehicle_registration="ABC-123",
        ),
    )

    # Simulate saving uploaded file outside the database in UPLOAD_DIR
    fake_filename = "dashcam_v1_front.mp4"
    incident_upload_dir = Path(settings.UPLOAD_DIR) / incident.id
    incident_upload_dir.mkdir(parents=True, exist_ok=True)
    fake_file_path = incident_upload_dir / fake_filename
    fake_file_path.write_bytes(b"Simulated video binary bytes stored outside DB")

    evidence_data = EvidenceCreate(
        incident_id=incident.id,
        party_id=party.id,
        evidence_type=EvidenceType.DASHCAM_VIDEO,
        original_filename=fake_filename,
        storage_reference=str(fake_file_path),
        processing_status=ProcessingStatus.PENDING,
        metadata={
            "duration_sec": 45.2,
            "fps": 30,
            "resolution": "1920x1080",
            "camera_position": "front_windshield",
        },
    )

    evidence = create_evidence(evidence_data)

    assert evidence.id is not None
    assert evidence.incident_id == incident.id
    assert evidence.party_id == party.id
    assert evidence.evidence_type == EvidenceType.DASHCAM_VIDEO
    assert evidence.original_filename == fake_filename
    assert evidence.storage_reference == str(fake_file_path)
    assert evidence.processing_status == ProcessingStatus.PENDING
    assert isinstance(evidence.upload_time, datetime)
    assert evidence.metadata["fps"] == 30

    # Ensure file exists on disk outside DB
    assert Path(evidence.storage_reference).exists()

    # Update processing status
    updated = update_evidence_status(
        evidence.id,
        status=ProcessingStatus.PROCESSED,
        metadata={"frames_extracted": 1356},
    )
    assert updated is not None
    assert updated.processing_status == ProcessingStatus.PROCESSED
    assert updated.metadata["frames_extracted"] == 1356
    assert updated.metadata["fps"] == 30  # Preserved earlier metadata


def test_evidence_foreign_key_relationship():
    """Verify evidence requires a valid incident_id foreign key."""
    with pytest.raises(sqlite3.IntegrityError):
        create_evidence(
            EvidenceCreate(
                incident_id="invalid-incident-id",
                evidence_type=EvidenceType.POLICE_REPORT,
                original_filename="report.pdf",
                storage_reference="data/uploads/report.pdf",
            )
        )
