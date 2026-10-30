"""API routes for forensic statement analysis and deterministic sensor analysis."""

from fastapi import APIRouter, Path
from app.models.sensor_analysis import SensorAnalysisResponse
from app.models.statement_analysis import StatementAnalysisResponse
from app.services.sensor_analysis import sensor_analysis_service
from app.services.statement_analyzer import statement_analyzer_service

router = APIRouter()


@router.post(
    "/incidents/{incident_id}/analyze-statements",
    response_model=StatementAnalysisResponse,
    summary="Analyze witness and party statements with Featherless AI",
    description=(
        "Extracts structured claims from party V1 and V2 statements, cross-examines "
        "them for conflicting and compatible assertions, generates targeted evidence requests, "
        "and saves the analysis to the SQLite database without hallucinating timestamps or truth."
    ),
    tags=["Statement Analysis"],
)
async def analyze_statements(
    incident_id: str = Path(..., description="Unique ID of the incident to analyze")
) -> StatementAnalysisResponse:
    """Trigger comparative witness statement analysis for an incident."""
    return await statement_analyzer_service.analyze_incident_statements(incident_id)


@router.post(
    "/incidents/{incident_id}/evidence/{evidence_id}/analyze-sensor",
    response_model=SensorAnalysisResponse,
    summary="Analyze vehicle sensor and telematics CSV evidence",
    description=(
        "Parses tabular sensor CSV with Pandas, validates columns and numeric data, "
        "detects observable kinematic patterns (rapid deceleration, stops, data gaps), "
        "and indexes extracted observations into SQLite without fabricating data or inferring collisions."
    ),
    tags=["Sensor Analysis"],
)
async def analyze_sensor_evidence(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    evidence_id: str = Path(..., description="Unique ID of the sensor CSV evidence to analyze"),
) -> SensorAnalysisResponse:
    """Analyze sensor CSV telemetry file for an incident."""
    return await sensor_analysis_service.analyze_evidence_sensor_file(
        incident_id=incident_id, evidence_id=evidence_id
    )
