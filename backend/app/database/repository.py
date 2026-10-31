"""Data access repository using parameterized SQLite queries and Pydantic validation."""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.database.connection import get_db_connection
from app.models.analysis_run import AnalysisRunCreate, AnalysisRunResponse, AnalysisRunUpdate
from app.models.contradiction import ContradictionCreate, ContradictionResponse
from app.models.enums import (
    AnalysisRunStatus,
    ContradictionSeverity,
    ContradictionStatus,
    EventClassification,
    EvidenceRequestStatus,
    EvidenceType,
    IncidentStatus,
    PartyLabel,
    ProcessingStatus,
)
from app.models.event import ExtractedEventCreate, ExtractedEventResponse
from app.models.evidence import EvidenceCreate, EvidenceResponse
from app.models.evidence_request import EvidenceRequestCreate, EvidenceRequestResponse
from app.models.incident import (
    IncidentCreate,
    IncidentDetailResponse,
    IncidentResponse,
    IncidentUpdate,
)
from app.models.party import PartyCreate, PartyResponse


def _utc_now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


def _to_iso(dt: Optional[datetime]) -> Optional[str]:
    """Convert datetime to ISO 8601 UTC string if present."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


# ============================================================================
# 1. INCIDENT REPOSITORY
# ============================================================================

def create_incident(data: IncidentCreate) -> IncidentResponse:
    """Insert a new incident with parameterized query."""
    incident_id = str(uuid4())
    created_at = _utc_now_iso()
    status_val = data.status.value if isinstance(data.status, IncidentStatus) else data.status

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO incidents (id, title, location, status, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (incident_id, data.title, data.location, status_val, created_at),
        )

    return IncidentResponse(
        id=incident_id,
        title=data.title,
        location=data.location,
        status=IncidentStatus(status_val),
        created_at=datetime.fromisoformat(created_at),
    )


def get_incident(incident_id: str) -> Optional[IncidentResponse]:
    """Retrieve an incident by primary key ID."""
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT id, title, location, status, created_at FROM incidents WHERE id = ?",
            (incident_id,),
        ).fetchone()

    if not row:
        return None

    return IncidentResponse(
        id=row["id"],
        title=row["title"],
        location=row["location"],
        status=IncidentStatus(row["status"]),
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def list_incidents() -> List[IncidentResponse]:
    """Retrieve all incidents sorted by creation time descending."""
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, title, location, status, created_at FROM incidents ORDER BY created_at DESC"
        ).fetchall()

    return [
        IncidentResponse(
            id=r["id"],
            title=r["title"],
            location=r["location"],
            status=IncidentStatus(r["status"]),
            created_at=datetime.fromisoformat(r["created_at"]),
        )
        for r in rows
    ]


def update_incident(incident_id: str, data: IncidentUpdate) -> Optional[IncidentResponse]:
    """Update fields of an existing incident."""
    existing = get_incident(incident_id)
    if not existing:
        return None

    updates = []
    params = []

    if data.title is not None:
        updates.append("title = ?")
        params.append(data.title)
    if data.location is not None:
        updates.append("location = ?")
        params.append(data.location)
    if data.status is not None:
        updates.append("status = ?")
        status_val = data.status.value if isinstance(data.status, IncidentStatus) else data.status
        params.append(status_val)

    if updates:
        params.append(incident_id)
        with get_db_connection() as conn:
            conn.execute(
                f"UPDATE incidents SET {', '.join(updates)} WHERE id = ?",
                params,
            )

    return get_incident(incident_id)


def delete_incident(incident_id: str) -> bool:
    """Delete an incident and cascades to parties, evidence, events, and runs."""
    with get_db_connection() as conn:
        cursor = conn.execute("DELETE FROM incidents WHERE id = ?", (incident_id,))
        return cursor.rowcount > 0


def get_incident_detail(incident_id: str) -> Optional[IncidentDetailResponse]:
    """Retrieve an incident with analysis history, parties, and counts."""
    incident = get_incident(incident_id)
    if not incident:
        return None

    parties = list_parties_for_incident(incident_id)
    analysis_history = list_analysis_runs_for_incident(incident_id)

    with get_db_connection() as conn:
        ev_count = conn.execute(
            "SELECT COUNT(*) as count FROM evidence WHERE incident_id = ?", (incident_id,)
        ).fetchone()["count"]
        ev_events = conn.execute(
            "SELECT COUNT(*) as count FROM extracted_events WHERE incident_id = ?", (incident_id,)
        ).fetchone()["count"]
        contra_count = conn.execute(
            "SELECT COUNT(*) as count FROM contradictions WHERE incident_id = ?", (incident_id,)
        ).fetchone()["count"]

    return IncidentDetailResponse(
        id=incident.id,
        title=incident.title,
        location=incident.location,
        status=incident.status,
        created_at=incident.created_at,
        analysis_history=analysis_history,
        parties=parties,
        evidence_count=ev_count,
        events_count=ev_events,
        contradictions_count=contra_count,
    )


# ============================================================================
# 2. PARTY REPOSITORY (V1 or V2)
# ============================================================================

def create_party(incident_id: str, data: PartyCreate) -> PartyResponse:
    """Create and link a party (strictly V1 or V2) to an incident."""
    party_id = str(uuid4())
    created_at = _utc_now_iso()
    label_val = data.party_label.value if isinstance(data.party_label, PartyLabel) else data.party_label

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO parties (id, incident_id, party_label, name, vehicle_registration, statement, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                party_id,
                incident_id,
                label_val,
                data.name,
                data.vehicle_registration,
                data.statement,
                created_at,
            ),
        )

    return PartyResponse(
        id=party_id,
        incident_id=incident_id,
        party_label=PartyLabel(label_val),
        name=data.name,
        vehicle_registration=data.vehicle_registration,
        statement=data.statement,
        created_at=datetime.fromisoformat(created_at),
    )


def get_party(party_id: str) -> Optional[PartyResponse]:
    """Retrieve a party by ID."""
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT id, incident_id, party_label, name, vehicle_registration, statement, created_at
            FROM parties WHERE id = ?
            """,
            (party_id,),
        ).fetchone()

    if not row:
        return None

    return PartyResponse(
        id=row["id"],
        incident_id=row["incident_id"],
        party_label=PartyLabel(row["party_label"]),
        name=row["name"],
        vehicle_registration=row["vehicle_registration"],
        statement=row["statement"],
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def list_parties_for_incident(incident_id: str) -> List[PartyResponse]:
    """Retrieve all parties for an incident sorted by party label."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, incident_id, party_label, name, vehicle_registration, statement, created_at
            FROM parties WHERE incident_id = ? ORDER BY party_label ASC
            """,
            (incident_id,),
        ).fetchall()

    return [
        PartyResponse(
            id=r["id"],
            incident_id=r["incident_id"],
            party_label=PartyLabel(r["party_label"]),
            name=r["name"],
            vehicle_registration=r["vehicle_registration"],
            statement=r["statement"],
            created_at=datetime.fromisoformat(r["created_at"]),
        )
        for r in rows
    ]


# ============================================================================
# 3. EVIDENCE REPOSITORY
# ============================================================================

def create_evidence(data: EvidenceCreate) -> EvidenceResponse:
    """Record an evidence reference pointing to external storage."""
    evidence_id = str(uuid4())
    upload_time = _utc_now_iso()
    ev_type_val = data.evidence_type.value if isinstance(data.evidence_type, EvidenceType) else data.evidence_type
    proc_val = (
        data.processing_status.value
        if isinstance(data.processing_status, ProcessingStatus)
        else data.processing_status
    )
    meta_json = json.dumps(data.metadata or {})

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO evidence (
                id, incident_id, party_id, evidence_request_id, evidence_type, original_filename,
                storage_reference, upload_time, processing_status, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                evidence_id,
                data.incident_id,
                data.party_id,
                data.evidence_request_id,
                ev_type_val,
                data.original_filename,
                data.storage_reference,
                upload_time,
                proc_val,
                meta_json,
            ),
        )

    return EvidenceResponse(
        id=evidence_id,
        incident_id=data.incident_id,
        party_id=data.party_id,
        evidence_request_id=data.evidence_request_id,
        evidence_type=EvidenceType(ev_type_val),
        original_filename=data.original_filename,
        storage_reference=data.storage_reference,
        upload_time=datetime.fromisoformat(upload_time),
        processing_status=ProcessingStatus(proc_val),
        metadata=data.metadata or {},
    )


def get_evidence(evidence_id: str) -> Optional[EvidenceResponse]:
    """Retrieve an evidence record by ID."""
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT id, incident_id, party_id, evidence_request_id, evidence_type, original_filename,
                   storage_reference, upload_time, processing_status, metadata
            FROM evidence WHERE id = ?
            """,
            (evidence_id,),
        ).fetchone()

    if not row:
        return None

    return EvidenceResponse(
        id=row["id"],
        incident_id=row["incident_id"],
        party_id=row["party_id"],
        evidence_request_id=row["evidence_request_id"] if "evidence_request_id" in row.keys() else None,
        evidence_type=EvidenceType(row["evidence_type"]),
        original_filename=row["original_filename"],
        storage_reference=row["storage_reference"],
        upload_time=datetime.fromisoformat(row["upload_time"]),
        processing_status=ProcessingStatus(row["processing_status"]),
        metadata=json.loads(row["metadata"]),
    )


def list_evidence_for_incident(incident_id: str) -> List[EvidenceResponse]:
    """Retrieve all evidence registered for an incident."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, incident_id, party_id, evidence_request_id, evidence_type, original_filename,
                   storage_reference, upload_time, processing_status, metadata
            FROM evidence WHERE incident_id = ? ORDER BY upload_time ASC
            """,
            (incident_id,),
        ).fetchall()

    return [
        EvidenceResponse(
            id=r["id"],
            incident_id=r["incident_id"],
            party_id=r["party_id"],
            evidence_request_id=r["evidence_request_id"] if "evidence_request_id" in r.keys() else None,
            evidence_type=EvidenceType(r["evidence_type"]),
            original_filename=r["original_filename"],
            storage_reference=r["storage_reference"],
            upload_time=datetime.fromisoformat(r["upload_time"]),
            processing_status=ProcessingStatus(r["processing_status"]),
            metadata=json.loads(r["metadata"]),
        )
        for r in rows
    ]


def update_evidence_status(
    evidence_id: str,
    status: ProcessingStatus,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[EvidenceResponse]:
    """Update evidence processing state and optionally append metadata."""
    existing = get_evidence(evidence_id)
    if not existing:
        return None

    status_val = status.value if isinstance(status, ProcessingStatus) else status

    with get_db_connection() as conn:
        if metadata is not None:
            combined_meta = {**existing.metadata, **metadata}
            conn.execute(
                """
                UPDATE evidence
                SET processing_status = ?, metadata = ?
                WHERE id = ?
                """,
                (status_val, json.dumps(combined_meta), evidence_id),
            )
        else:
            conn.execute(
                "UPDATE evidence SET processing_status = ? WHERE id = ?",
                (status_val, evidence_id),
            )

    return get_evidence(evidence_id)


# ============================================================================
# 4. EXTRACTED EVENT REPOSITORY
# ============================================================================

def create_event(data: ExtractedEventCreate) -> ExtractedEventResponse:
    """Create an extracted timeline event or party claim."""
    event_id = str(uuid4())
    created_at = _utc_now_iso()
    class_val = (
        data.classification.value
        if isinstance(data.classification, EventClassification)
        else data.classification
    )
    wall_iso = _to_iso(data.wall_clock_timestamp)
    wall_end_iso = _to_iso(data.wall_clock_end_timestamp)
    refs_json = json.dumps(data.evidence_references or [])
    meta_json = json.dumps(data.metadata or {})

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO extracted_events (
                id, incident_id, source_id, event_type, description, classification,
                wall_clock_timestamp, wall_clock_end_timestamp,
                video_offset_seconds, video_end_offset_seconds,
                evidence_references, confidence, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                data.incident_id,
                data.source_id,
                data.event_type,
                data.description,
                class_val,
                wall_iso,
                wall_end_iso,
                data.video_offset_seconds,
                data.video_end_offset_seconds,
                refs_json,
                data.confidence,
                meta_json,
                created_at,
            ),
        )

    return ExtractedEventResponse(
        id=event_id,
        incident_id=data.incident_id,
        source_id=data.source_id,
        event_type=data.event_type,
        description=data.description,
        classification=EventClassification(class_val),
        wall_clock_timestamp=data.wall_clock_timestamp,
        wall_clock_end_timestamp=data.wall_clock_end_timestamp,
        video_offset_seconds=data.video_offset_seconds,
        video_end_offset_seconds=data.video_end_offset_seconds,
        evidence_references=data.evidence_references or [],
        confidence=data.confidence,
        metadata=data.metadata or {},
        created_at=datetime.fromisoformat(created_at),
    )


def get_event(event_id: str) -> Optional[ExtractedEventResponse]:
    """Retrieve an extracted event by ID."""
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT id, incident_id, source_id, event_type, description, classification,
                   wall_clock_timestamp, wall_clock_end_timestamp,
                   video_offset_seconds, video_end_offset_seconds,
                   evidence_references, confidence, metadata, created_at
            FROM extracted_events WHERE id = ?
            """,
            (event_id,),
        ).fetchone()

    if not row:
        return None

    return ExtractedEventResponse(
        id=row["id"],
        incident_id=row["incident_id"],
        source_id=row["source_id"],
        event_type=row["event_type"],
        description=row["description"],
        classification=EventClassification(row["classification"]),
        wall_clock_timestamp=(
            datetime.fromisoformat(row["wall_clock_timestamp"])
            if row["wall_clock_timestamp"]
            else None
        ),
        wall_clock_end_timestamp=(
            datetime.fromisoformat(row["wall_clock_end_timestamp"])
            if row["wall_clock_end_timestamp"]
            else None
        ),
        video_offset_seconds=row["video_offset_seconds"],
        video_end_offset_seconds=row["video_end_offset_seconds"],
        evidence_references=json.loads(row["evidence_references"]),
        confidence=row["confidence"],
        metadata=json.loads(row["metadata"]),
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def list_events_for_incident(incident_id: str) -> List[ExtractedEventResponse]:
    """Retrieve all events/claims for an incident."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, incident_id, source_id, event_type, description, classification,
                   wall_clock_timestamp, wall_clock_end_timestamp,
                   video_offset_seconds, video_end_offset_seconds,
                   evidence_references, confidence, metadata, created_at
            FROM extracted_events WHERE incident_id = ?
            ORDER BY video_offset_seconds ASC, wall_clock_timestamp ASC, created_at ASC
            """,
            (incident_id,),
        ).fetchall()

    return [
        ExtractedEventResponse(
            id=r["id"],
            incident_id=r["incident_id"],
            source_id=r["source_id"],
            event_type=r["event_type"],
            description=r["description"],
            classification=EventClassification(r["classification"]),
            wall_clock_timestamp=(
                datetime.fromisoformat(r["wall_clock_timestamp"])
                if r["wall_clock_timestamp"]
                else None
            ),
            wall_clock_end_timestamp=(
                datetime.fromisoformat(r["wall_clock_end_timestamp"])
                if r["wall_clock_end_timestamp"]
                else None
            ),
            video_offset_seconds=r["video_offset_seconds"],
            video_end_offset_seconds=r["video_end_offset_seconds"],
            evidence_references=json.loads(r["evidence_references"]),
            confidence=r["confidence"],
            metadata=json.loads(r["metadata"]),
            created_at=datetime.fromisoformat(r["created_at"]),
        )
        for r in rows
    ]


# ============================================================================
# 5. CONTRADICTION REPOSITORY
# ============================================================================

def create_contradiction(data: ContradictionCreate) -> ContradictionResponse:
    """Record an identified timeline contradiction."""
    cid = str(uuid4())
    created_at = _utc_now_iso()
    sev_val = data.severity.value if isinstance(data.severity, ContradictionSeverity) else data.severity
    stat_val = data.status.value if isinstance(data.status, ContradictionStatus) else data.status

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO contradictions (
                id, incident_id, title, description, event_id_a, event_id_b, severity, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cid,
                data.incident_id,
                data.title,
                data.description,
                data.event_id_a,
                data.event_id_b,
                sev_val,
                stat_val,
                created_at,
            ),
        )

    return ContradictionResponse(
        id=cid,
        incident_id=data.incident_id,
        title=data.title,
        description=data.description,
        event_id_a=data.event_id_a,
        event_id_b=data.event_id_b,
        severity=ContradictionSeverity(sev_val),
        status=ContradictionStatus(stat_val),
        created_at=datetime.fromisoformat(created_at),
    )


def get_contradiction(cid: str) -> Optional[ContradictionResponse]:
    """Retrieve a contradiction by ID."""
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT id, incident_id, title, description, event_id_a, event_id_b, severity, status, created_at
            FROM contradictions WHERE id = ?
            """,
            (cid,),
        ).fetchone()

    if not row:
        return None

    return ContradictionResponse(
        id=row["id"],
        incident_id=row["incident_id"],
        title=row["title"],
        description=row["description"],
        event_id_a=row["event_id_a"],
        event_id_b=row["event_id_b"],
        severity=ContradictionSeverity(row["severity"]),
        status=ContradictionStatus(row["status"]),
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def list_contradictions_for_incident(incident_id: str) -> List[ContradictionResponse]:
    """Retrieve all contradictions for an incident."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, incident_id, title, description, event_id_a, event_id_b, severity, status, created_at
            FROM contradictions WHERE incident_id = ? ORDER BY created_at DESC
            """,
            (incident_id,),
        ).fetchall()

    return [
        ContradictionResponse(
            id=r["id"],
            incident_id=r["incident_id"],
            title=r["title"],
            description=r["description"],
            event_id_a=r["event_id_a"],
            event_id_b=r["event_id_b"],
            severity=ContradictionSeverity(r["severity"]),
            status=ContradictionStatus(r["status"]),
            created_at=datetime.fromisoformat(r["created_at"]),
        )
        for r in rows
    ]


# ============================================================================
# 6. EVIDENCE REQUEST REPOSITORY
# ============================================================================

def create_evidence_request(data: EvidenceRequestCreate) -> EvidenceRequestResponse:
    """Create a request for additional evidence."""
    req_id = str(uuid4())
    created_at = _utc_now_iso()
    status_val = (
        data.status.value
        if isinstance(data.status, EvidenceRequestStatus)
        else data.status
    )

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO evidence_requests (
                id, incident_id, request_type, description, target_party, status, fulfilled_evidence_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                req_id,
                data.incident_id,
                data.request_type,
                data.description,
                data.target_party,
                status_val,
                data.fulfilled_evidence_id,
                created_at,
            ),
        )

    return EvidenceRequestResponse(
        id=req_id,
        incident_id=data.incident_id,
        request_type=data.request_type,
        description=data.description,
        target_party=data.target_party,
        status=EvidenceRequestStatus(status_val),
        fulfilled_evidence_id=data.fulfilled_evidence_id,
        created_at=datetime.fromisoformat(created_at),
    )


def get_evidence_request(req_id: str) -> Optional[EvidenceRequestResponse]:
    """Retrieve an evidence request by ID."""
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT id, incident_id, request_type, description, target_party, status, fulfilled_evidence_id, created_at
            FROM evidence_requests WHERE id = ?
            """,
            (req_id,),
        ).fetchone()

    if not row:
        return None

    return EvidenceRequestResponse(
        id=row["id"],
        incident_id=row["incident_id"],
        request_type=row["request_type"],
        description=row["description"],
        target_party=row["target_party"],
        status=EvidenceRequestStatus(row["status"]),
        fulfilled_evidence_id=row["fulfilled_evidence_id"],
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def list_evidence_requests_for_incident(incident_id: str) -> List[EvidenceRequestResponse]:
    """Retrieve all evidence requests for an incident."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, incident_id, request_type, description, target_party, status, fulfilled_evidence_id, created_at
            FROM evidence_requests WHERE incident_id = ? ORDER BY created_at DESC
            """,
            (incident_id,),
        ).fetchall()

    return [
        EvidenceRequestResponse(
            id=r["id"],
            incident_id=r["incident_id"],
            request_type=r["request_type"],
            description=r["description"],
            target_party=r["target_party"],
            status=EvidenceRequestStatus(r["status"]),
            fulfilled_evidence_id=r["fulfilled_evidence_id"],
            created_at=datetime.fromisoformat(r["created_at"]),
        )
        for r in rows
    ]


def dismiss_evidence_request(req_id: str) -> Optional[EvidenceRequestResponse]:
    """Dismiss an evidence request by updating its status to 'dismissed'."""
    existing = get_evidence_request(req_id)
    if not existing:
        return None

    with get_db_connection() as conn:
        conn.execute(
            "UPDATE evidence_requests SET status = ? WHERE id = ?",
            (EvidenceRequestStatus.DISMISSED.value, req_id),
        )

    return get_evidence_request(req_id)


def fulfill_evidence_request(req_id: str, evidence_id: str) -> Optional[EvidenceRequestResponse]:
    """Mark an evidence request fulfilled by linking the fulfilling evidence ID."""
    existing = get_evidence_request(req_id)
    if not existing:
        return None

    with get_db_connection() as conn:
        conn.execute(
            "UPDATE evidence_requests SET status = ?, fulfilled_evidence_id = ? WHERE id = ?",
            (EvidenceRequestStatus.FULFILLED.value, evidence_id, req_id),
        )

    return get_evidence_request(req_id)


# ============================================================================
# 7. ANALYSIS RUN REPOSITORY (Analysis History)
# ============================================================================

def create_analysis_run(data: AnalysisRunCreate) -> AnalysisRunResponse:
    """Record the initiation of an analytical reconstruction run."""
    run_id = str(uuid4())
    started_at = _to_iso(data.started_at) or _utc_now_iso()
    status_val = (
        data.status.value
        if isinstance(data.status, AnalysisRunStatus)
        else data.status
    )
    findings_json = json.dumps(data.findings or {})

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO analysis_runs (
                id, incident_id, run_type, status, summary, findings, error_message, started_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                data.incident_id,
                data.run_type,
                status_val,
                data.summary,
                findings_json,
                data.error_message,
                started_at,
                None,
            ),
        )

    return AnalysisRunResponse(
        id=run_id,
        incident_id=data.incident_id,
        run_type=data.run_type,
        status=AnalysisRunStatus(status_val),
        summary=data.summary,
        findings=data.findings or {},
        error_message=data.error_message,
        started_at=datetime.fromisoformat(started_at),
        completed_at=None,
    )


def get_analysis_run(run_id: str) -> Optional[AnalysisRunResponse]:
    """Retrieve an analysis run by ID."""
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT id, incident_id, run_type, status, summary, findings, error_message, started_at, completed_at
            FROM analysis_runs WHERE id = ?
            """,
            (run_id,),
        ).fetchone()

    if not row:
        return None

    return AnalysisRunResponse(
        id=row["id"],
        incident_id=row["incident_id"],
        run_type=row["run_type"],
        status=AnalysisRunStatus(row["status"]),
        summary=row["summary"],
        findings=json.loads(row["findings"]),
        error_message=row["error_message"],
        started_at=datetime.fromisoformat(row["started_at"]),
        completed_at=(
            datetime.fromisoformat(row["completed_at"])
            if row["completed_at"]
            else None
        ),
    )


def list_analysis_runs_for_incident(incident_id: str) -> List[AnalysisRunResponse]:
    """Retrieve all analysis runs for an incident, ordered by started_at."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, incident_id, run_type, status, summary, findings, error_message, started_at, completed_at
            FROM analysis_runs WHERE incident_id = ? ORDER BY started_at ASC
            """,
            (incident_id,),
        ).fetchall()

    return [
        AnalysisRunResponse(
            id=r["id"],
            incident_id=r["incident_id"],
            run_type=r["run_type"],
            status=AnalysisRunStatus(r["status"]),
            summary=r["summary"],
            findings=json.loads(r["findings"]),
            error_message=r["error_message"],
            started_at=datetime.fromisoformat(r["started_at"]),
            completed_at=(
                datetime.fromisoformat(r["completed_at"])
                if r["completed_at"]
                else None
            ),
        )
        for r in rows
    ]


def update_analysis_run(run_id: str, data: AnalysisRunUpdate) -> Optional[AnalysisRunResponse]:
    """Update status, completion timestamp, and findings of an analysis run."""
    existing = get_analysis_run(run_id)
    if not existing:
        return None

    updates = []
    params = []

    if data.status is not None:
        status_val = data.status.value if isinstance(data.status, AnalysisRunStatus) else data.status
        updates.append("status = ?")
        params.append(status_val)

    if data.completed_at is not None:
        updates.append("completed_at = ?")
        params.append(_to_iso(data.completed_at))

    if data.summary is not None:
        updates.append("summary = ?")
        params.append(data.summary)

    if data.findings is not None:
        combined = {**existing.findings, **data.findings}
        updates.append("findings = ?")
        params.append(json.dumps(combined))

    if data.error_message is not None:
        updates.append("error_message = ?")
        params.append(data.error_message)

    if updates:
        params.append(run_id)
        with get_db_connection() as conn:
            conn.execute(
                f"UPDATE analysis_runs SET {', '.join(updates)} WHERE id = ?",
                params,
            )

    return get_analysis_run(run_id)


# ============================================================================
# 8. REPORT REPOSITORY
# ============================================================================

def save_report(
    incident_id: str,
    title: str,
    report_data: Dict[str, Any],
    report_id: Optional[str] = None,
    analysis_run_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist an investigation report to the database."""
    rep_id = report_id or str(uuid4())
    generated_at = _utc_now_iso()

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO reports (id, incident_id, analysis_run_id, title, report_data, generated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                rep_id,
                incident_id,
                analysis_run_id,
                title,
                json.dumps(report_data, default=str),
                generated_at,
            ),
        )

    return {
        "id": rep_id,
        "incident_id": incident_id,
        "analysis_run_id": analysis_run_id,
        "title": title,
        "report_data": report_data,
        "generated_at": generated_at,
    }


def get_report(report_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve an investigation report by ID."""
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT id, incident_id, analysis_run_id, title, report_data, generated_at FROM reports WHERE id = ?",
            (report_id,),
        ).fetchone()

    if not row:
        return None

    return {
        "id": row["id"],
        "incident_id": row["incident_id"],
        "analysis_run_id": row["analysis_run_id"],
        "title": row["title"],
        "report_data": json.loads(row["report_data"]),
        "generated_at": row["generated_at"],
    }


def get_latest_report_for_incident(incident_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve the most recent investigation report for an incident."""
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT id, incident_id, analysis_run_id, title, report_data, generated_at
            FROM reports
            WHERE incident_id = ?
            ORDER BY generated_at DESC
            LIMIT 1
            """,
            (incident_id,),
        ).fetchone()

    if not row:
        return None

    return {
        "id": row["id"],
        "incident_id": row["incident_id"],
        "analysis_run_id": row["analysis_run_id"],
        "title": row["title"],
        "report_data": json.loads(row["report_data"]),
        "generated_at": row["generated_at"],
    }


def list_reports_for_incident(incident_id: str) -> List[Dict[str, Any]]:
    """Retrieve all investigation reports for an incident ordered chronologically."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, incident_id, analysis_run_id, title, report_data, generated_at
            FROM reports
            WHERE incident_id = ?
            ORDER BY generated_at DESC
            """,
            (incident_id,),
        ).fetchall()

    return [
        {
            "id": r["id"],
            "incident_id": r["incident_id"],
            "analysis_run_id": r["analysis_run_id"],
            "title": r["title"],
            "report_data": json.loads(r["report_data"]),
            "generated_at": r["generated_at"],
        }
        for r in rows
    ]

