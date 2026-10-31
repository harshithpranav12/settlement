"""API endpoints for evidence upload, retrieval, and evidence request management."""

import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Path, Request, status

from app.database import (
    dismiss_evidence_request,
    get_evidence_request,
    get_incident,
    list_evidence_for_incident,
    list_evidence_requests_for_incident,
)
from app.models.enums import EvidenceType
from app.models.evidence import EvidenceResponse, WitnessStatementCreate
from app.models.evidence_request import EvidenceRequestResponse
from app.services.evidence_service import evidence_service

router = APIRouter()


@router.post(
    "/incidents/{incident_id}/evidence",
    response_model=EvidenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload evidence file (multipart) or record witness statement (JSON)",
    description=(
        "Accepts multipart/form-data for video (MP4, AVI, MOV) and sensor data (CSV, TSV, logs) "
        "OR application/json for structured witness statements. "
        "Files are stored securely outside public web roots with streaming bounded reads and SHA-256 integrity verification."
    ),
    tags=["Evidence Management"],
    openapi_extra={
        "requestBody": {
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "file": {
                                "type": "string",
                                "format": "binary",
                                "description": "Binary evidence file (video, sensor CSV, etc.)",
                            },
                            "evidence_type": {
                                "type": "string",
                                "enum": [e.value for e in EvidenceType],
                                "description": "Optional evidence classification",
                            },
                            "party_id": {
                                "type": "string",
                                "description": "Optional ID of associated party (V1 or V2)",
                            },
                            "evidence_request_id": {
                                "type": "string",
                                "description": "Optional evidence request ID being satisfied",
                            },
                            "metadata": {
                                "type": "string",
                                "description": "Optional JSON string with custom metadata",
                            },
                        },
                        "required": ["file"],
                    }
                },
                "application/json": {
                    "schema": WitnessStatementCreate.model_json_schema()
                },
            }
        }
    },
)
async def create_evidence_item(
    incident_id: str,
    request: Request,
) -> EvidenceResponse:
    """Handle multipart file upload or JSON witness statement."""
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload provided.",
            ) from exc

        statement_data = WitnessStatementCreate.model_validate(body)
        return await evidence_service.save_witness_statement(incident_id, statement_data)

    elif "multipart/form-data" in content_type:
        form = await request.form()
        file_obj = form.get("file")
        if not file_obj:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multipart request missing required 'file' upload field.",
            )

        evidence_type = form.get("evidence_type")
        party_id = form.get("party_id")
        evidence_request_id = form.get("evidence_request_id")
        meta_raw = form.get("metadata")

        metadata = None
        if meta_raw:
            try:
                metadata = json.loads(meta_raw) if isinstance(meta_raw, str) else meta_raw
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid JSON string in 'metadata' field.",
                ) from exc

        return await evidence_service.save_uploaded_file(
            incident_id=incident_id,
            file=file_obj,
            evidence_type=str(evidence_type) if evidence_type else None,
            party_id=str(party_id) if party_id else None,
            evidence_request_id=str(evidence_request_id) if evidence_request_id else None,
            custom_metadata=metadata,
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                "Unsupported Content-Type. Use 'multipart/form-data' to upload media/sensor files, "
                "or 'application/json' to submit structured witness statements."
            ),
        )


@router.get(
    "/incidents/{incident_id}/evidence",
    response_model=List[EvidenceResponse],
    summary="List all evidence items for an incident",
    tags=["Evidence Management"],
)
async def get_incident_evidence(
    incident_id: str = Path(..., description="ID of the incident"),
) -> List[EvidenceResponse]:
    """Retrieve all evidence registered for the incident."""
    incident = get_incident(incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )
    return list_evidence_for_incident(incident_id)


@router.get(
    "/incidents/{incident_id}/evidence-requests",
    response_model=List[EvidenceRequestResponse],
    summary="List all evidence requests for an incident",
    tags=["Evidence Management"],
)
async def get_incident_evidence_requests(
    incident_id: str = Path(..., description="ID of the incident"),
) -> List[EvidenceRequestResponse]:
    """Retrieve all evidence requests generated for the incident."""
    incident = get_incident(incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )
    return list_evidence_requests_for_incident(incident_id)


@router.post(
    "/incidents/{incident_id}/evidence-requests/{request_id}/dismiss",
    response_model=EvidenceRequestResponse,
    summary="Dismiss an evidence request",
    description="Updates the evidence request status to 'dismissed'.",
    tags=["Evidence Management"],
)
async def dismiss_request(
    incident_id: str = Path(..., description="ID of the incident"),
    request_id: str = Path(..., description="ID of the evidence request to dismiss"),
) -> EvidenceRequestResponse:
    """Dismiss an outstanding evidence request."""
    incident = get_incident(incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )

    req = get_evidence_request(request_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence request with ID '{request_id}' not found.",
        )

    if req.incident_id != incident_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Evidence request '{request_id}' does not belong to incident '{incident_id}'.",
        )

    updated = dismiss_evidence_request(request_id)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update evidence request status.",
        )

    return updated
