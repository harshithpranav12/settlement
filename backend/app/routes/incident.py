"""API routes for Incident and Party management."""

from typing import List
from fastapi import APIRouter, HTTPException, Path, status

from app.database import (
    create_incident,
    create_party,
    delete_incident,
    get_incident,
    get_incident_detail,
    list_incidents,
    list_parties_for_incident,
    update_incident,
)
from app.models.incident import (
    IncidentCreate,
    IncidentDetailResponse,
    IncidentResponse,
    IncidentUpdate,
)
from app.models.party import PartyCreate, PartyResponse

router = APIRouter()


@router.post(
    "/incidents",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new incident case",
    tags=["Incidents"],
)
async def create_new_incident(data: IncidentCreate) -> IncidentResponse:
    """Register a new accident incident investigation case."""
    return create_incident(data)


@router.get(
    "/incidents",
    response_model=List[IncidentResponse],
    summary="List all recorded incidents",
    tags=["Incidents"],
)
async def get_all_incidents() -> List[IncidentResponse]:
    """Retrieve all incident records ordered by creation date descending."""
    return list_incidents()


@router.get(
    "/incidents/{incident_id}",
    response_model=IncidentDetailResponse,
    summary="Retrieve incident details with parties, evidence, and analysis runs",
    tags=["Incidents"],
)
async def get_incident_by_id(
    incident_id: str = Path(..., description="Unique ID of the incident"),
) -> IncidentDetailResponse:
    """Retrieve an incident including its associated parties, evidence items, and runs."""
    incident = get_incident_detail(incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )
    return incident


@router.patch(
    "/incidents/{incident_id}",
    response_model=IncidentResponse,
    summary="Update incident metadata or status",
    tags=["Incidents"],
)
async def update_incident_by_id(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    data: IncidentUpdate = ...,
) -> IncidentResponse:
    """Update title, location, or status of an incident."""
    updated = update_incident(incident_id, data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )
    return updated


@router.delete(
    "/incidents/{incident_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an incident and associated records",
    tags=["Incidents"],
)
async def delete_incident_by_id(
    incident_id: str = Path(..., description="Unique ID of the incident"),
) -> None:
    """Delete an incident along with all parties and evidence (cascaded)."""
    deleted = delete_incident(incident_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )


@router.post(
    "/incidents/{incident_id}/parties",
    response_model=PartyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register an involved party (V1 or V2) with statement",
    tags=["Parties"],
)
async def add_incident_party(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    data: PartyCreate = ...,
) -> PartyResponse:
    """Add party V1 or V2 with vehicle registration and statement to the incident."""
    incident = get_incident(incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )
    try:
        return create_party(incident_id=incident_id, data=data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/incidents/{incident_id}/parties",
    response_model=List[PartyResponse],
    summary="List all involved parties for an incident",
    tags=["Parties"],
)
async def get_incident_parties(
    incident_id: str = Path(..., description="Unique ID of the incident"),
) -> List[PartyResponse]:
    """Retrieve all parties associated with the incident."""
    incident = get_incident(incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )
    return list_parties_for_incident(incident_id)
