"""Evidence management service for secure file ingestion and witness statements.

Provides bounded chunked streaming, safe file naming, path traversal prevention,
format validation, and SQLite evidence record linking.
"""

import hashlib
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, Optional, Set
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.config import settings
from app.database import (
    create_evidence,
    fulfill_evidence_request,
    get_evidence_request,
    get_incident,
    get_party,
)
from app.models.enums import EvidenceType, ProcessingStatus
from app.models.evidence import EvidenceCreate, EvidenceResponse, WitnessStatementCreate

logger = logging.getLogger("trace_ai.evidence")

# Allowed extensions mapped to standard evidence categories
ALLOWED_VIDEO_EXTENSIONS: Set[str] = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
ALLOWED_SENSOR_EXTENSIONS: Set[str] = {".csv", ".tsv", ".txt", ".json", ".gpx", ".kml"}
ALLOWED_DOCUMENT_EXTENSIONS: Set[str] = {".pdf", ".jpg", ".jpeg", ".png"}

ALL_ALLOWED_EXTENSIONS: Set[str] = (
    ALLOWED_VIDEO_EXTENSIONS | ALLOWED_SENSOR_EXTENSIONS | ALLOWED_DOCUMENT_EXTENSIONS
)

CHUNK_SIZE = 1024 * 1024  # 1 MB stream chunk


def _sanitize_base_name(filename: str) -> str:
    """Extract a safe alpha-numeric base name from user-supplied filename."""
    base = Path(filename).stem
    # Replace non-alphanumeric chars with underscore and limit length
    safe_base = re.sub(r"[^a-zA-Z0-9_\-]", "_", base)[:32]
    return safe_base or "evidence"


def _determine_evidence_type(ext: str, user_type: Optional[str]) -> EvidenceType:
    """Infer or validate evidence type based on file extension and user hint."""
    if user_type:
        try:
            return EvidenceType(user_type)
        except ValueError:
            pass  # Fallback to extension deduction

    if ext in ALLOWED_VIDEO_EXTENSIONS:
        return EvidenceType.DASHCAM_VIDEO
    if ext in {".csv", ".tsv"}:
        return EvidenceType.TELEMATICS
    if ext in {".gpx", ".kml"}:
        return EvidenceType.GPS_LOG
    if ext in {".jpg", ".jpeg", ".png"}:
        return EvidenceType.PHOTO
    if ext == ".pdf":
        return EvidenceType.POLICE_REPORT
    return EvidenceType.OTHER


class EvidenceService:
    """Service handling file storage, validation, and metadata indexing for evidence."""

    def _ensure_incident_dir(self, incident_id: str) -> Path:
        """Create and return the isolated storage directory for an incident."""
        incident_dir = Path(settings.UPLOAD_DIR) / "incidents" / incident_id
        incident_dir.mkdir(parents=True, exist_ok=True)
        return incident_dir

    def _validate_incident(self, incident_id: str) -> None:
        """Ensure incident exists in database."""
        incident = get_incident(incident_id)
        if not incident:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident with ID '{incident_id}' not found.",
            )

    def _validate_evidence_request(
        self, incident_id: str, request_id: Optional[str]
    ) -> None:
        """Validate evidence request exists and matches incident if provided."""
        if not request_id:
            return
        req = get_evidence_request(request_id)
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence request '{request_id}' not found.",
            )
        if req.incident_id != incident_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Evidence request '{request_id}' does not belong to incident '{incident_id}'.",
            )

    def _validate_party(self, incident_id: str, party_id: Optional[str]) -> None:
        """Ensure party exists and belongs to incident if specified."""
        if not party_id:
            return
        party = get_party(party_id)
        if not party or party.incident_id != incident_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Party '{party_id}' is not associated with incident '{incident_id}'.",
            )

    async def save_uploaded_file(
        self,
        incident_id: str,
        file: UploadFile,
        evidence_type: Optional[str] = None,
        party_id: Optional[str] = None,
        evidence_request_id: Optional[str] = None,
        custom_metadata: Optional[Dict[str, Any]] = None,
    ) -> EvidenceResponse:
        """Stream an uploaded file to bounded disk storage and index in database."""
        self._validate_incident(incident_id)
        self._validate_evidence_request(incident_id, evidence_request_id)
        self._validate_party(incident_id, party_id)

        raw_filename = file.filename or "uploaded_file"
        clean_ext = Path(raw_filename).suffix.lower()

        # Format restriction check
        if clean_ext not in ALL_ALLOWED_EXTENSIONS:
            allowed_fmt_str = ", ".join(sorted(ALL_ALLOWED_EXTENSIONS))
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=(
                    f"Unsupported file format '{clean_ext}'. "
                    f"Allowed formats are: {allowed_fmt_str}."
                ),
            )

        inferred_type = _determine_evidence_type(clean_ext, evidence_type)
        incident_dir = self._ensure_incident_dir(incident_id)

        # Generate unique, non-guessable, traversal-safe filename
        safe_base = _sanitize_base_name(raw_filename)
        safe_filename = f"{uuid4().hex}_{safe_base}{clean_ext}"
        destination = incident_dir / safe_filename

        # Path traversal guard
        try:
            resolved_dest = destination.resolve()
            resolved_upload_dir = Path(settings.UPLOAD_DIR).resolve()
            if not resolved_dest.is_relative_to(resolved_upload_dir):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid destination path detected.",
                )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security validation failed for upload destination.",
            ) from exc

        # Bounded streaming read (never load entire file into RAM at once)
        max_bytes = settings.max_upload_size_bytes
        total_bytes = 0
        hasher = hashlib.sha256()

        try:
            with open(destination, "wb") as buffer:
                while chunk := await file.read(CHUNK_SIZE):
                    total_bytes += len(chunk)
                    if total_bytes > max_bytes:
                        # File exceeded limit: abort and clean up disk
                        buffer.close()
                        destination.unlink(missing_ok=True)
                        max_mb = settings.MAX_UPLOAD_SIZE_MB
                        raise HTTPException(
                            status_code=getattr(
                                status,
                                "HTTP_413_CONTENT_TOO_LARGE",
                                413,
                            ),
                            detail=(
                                f"File size exceeds maximum allowed limit of {max_mb} MB. "
                                f"Upload aborted."
                            ),
                        )
                    hasher.update(chunk)
                    buffer.write(chunk)
        except HTTPException:
            raise
        except Exception as exc:
            destination.unlink(missing_ok=True)
            logger.error("File stream write failure for incident %s: %s", incident_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store uploaded file on the server.",
            ) from exc

        # Build metadata dictionary
        meta: Dict[str, Any] = {
            "file_size_bytes": total_bytes,
            "sha256": hasher.hexdigest(),
            "content_type": file.content_type,
            "original_filename": Path(raw_filename).name,
        }
        if custom_metadata:
            meta.update(custom_metadata)

        # Create evidence database record
        evidence = create_evidence(
            EvidenceCreate(
                incident_id=incident_id,
                party_id=party_id,
                evidence_request_id=evidence_request_id,
                evidence_type=inferred_type,
                original_filename=Path(raw_filename).name,
                storage_reference=str(destination),
                processing_status=ProcessingStatus.UPLOADED,
                metadata=meta,
            )
        )

        # If addressing an evidence request, mark request fulfilled
        if evidence_request_id:
            fulfill_evidence_request(evidence_request_id, evidence.id)

        logger.info(
            "Evidence recorded successfully: id=%s type=%s size=%d bytes for incident=%s",
            evidence.id,
            evidence.evidence_type.value,
            total_bytes,
            incident_id,
        )
        return evidence

    async def save_witness_statement(
        self, incident_id: str, data: WitnessStatementCreate
    ) -> EvidenceResponse:
        """Save a structured witness statement as dedicated evidence."""
        self._validate_incident(incident_id)
        self._validate_evidence_request(incident_id, data.evidence_request_id)
        self._validate_party(incident_id, data.party_id)

        incident_dir = self._ensure_incident_dir(incident_id)
        stmt_id = uuid4().hex
        safe_filename = f"statement_{stmt_id}.json"
        destination = incident_dir / safe_filename

        statement_payload = {
            "witness_name": data.witness_name,
            "statement": data.statement,
            "party_label": data.party_label.value if data.party_label else None,
            "party_id": data.party_id,
            "metadata": data.metadata,
        }

        # Write statement outside database to storage reference
        destination.write_text(json.dumps(statement_payload, indent=2), encoding="utf-8")

        meta: Dict[str, Any] = {
            "witness_name": data.witness_name,
            "party_label": data.party_label.value if data.party_label else None,
            "statement_length_chars": len(data.statement),
            "sha256": hashlib.sha256(data.statement.encode("utf-8")).hexdigest(),
        }
        if data.metadata:
            meta.update(data.metadata)

        evidence = create_evidence(
            EvidenceCreate(
                incident_id=incident_id,
                party_id=data.party_id,
                evidence_request_id=data.evidence_request_id,
                evidence_type=EvidenceType.WITNESS_STATEMENT,
                original_filename=f"{data.witness_name}_statement.txt",
                storage_reference=str(destination),
                processing_status=ProcessingStatus.COMPLETED,
                metadata=meta,
            )
        )

        if data.evidence_request_id:
            fulfill_evidence_request(data.evidence_request_id, evidence.id)

        logger.info(
            "Witness statement recorded: evidence_id=%s witness=%s chars=%d for incident=%s",
            evidence.id,
            data.witness_name,
            len(data.statement),
            incident_id,
        )
        return evidence


evidence_service = EvidenceService()
