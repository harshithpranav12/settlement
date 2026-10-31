"""API routes for forensic statement analysis, sensor analysis, timeline, contradiction, and report generation."""

from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, Path, Query, UploadFile, status

from app.database import get_latest_report_for_incident
from app.models.contradiction_engine import ContradictionEngineResponse
from app.models.investigation import InvestigationWorkflowResponse
from app.models.report import InvestigationReportResponse
from app.models.sensor_analysis import SensorAnalysisResponse
from app.models.statement_analysis import StatementAnalysisResponse
from app.models.timeline import TimelineResponse, TimelineSyncRequest
from app.models.video_analysis import VideoAnalysisPayload, VideoAnalysisResponse
from app.services.contradiction_engine import contradiction_engine_service
from app.services.investigation_engine import investigation_engine_service
from app.services.report_generator import report_generator_service
from app.services.sensor_analysis import sensor_analysis_service
from app.services.statement_analyzer import statement_analyzer_service
from app.services.timeline_engine import timeline_engine_service
from app.services.video_analysis import video_analysis_service

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


@router.post(
    "/incidents/{incident_id}/cv-detections",
    response_model=VideoAnalysisResponse,
    summary="Ingest computer-vision detection results for incident video",
    description=(
        "Accepts structured frame-by-frame vehicle and road user detection bounding boxes from the vision pipeline. "
        "Validates geometric coordinates, generates pixel-space trajectories, assigns unverified track labels, "
        "and creates normalized observation events in SQLite without asserting fault or collision."
    ),
    tags=["Video & Computer Vision Analysis"],
)
async def ingest_cv_detections(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    payload: VideoAnalysisPayload = ...,
) -> VideoAnalysisResponse:
    """Ingest computer vision results conforming to the CV module contract."""
    return video_analysis_service.process_detection_results(
        incident_id=incident_id, detection_data=payload
    )


@router.post(
    "/incidents/{incident_id}/evidence/{evidence_id}/cv-detections",
    response_model=VideoAnalysisResponse,
    summary="Ingest computer-vision detections explicitly tied to evidence item",
    tags=["Video & Computer Vision Analysis"],
)
async def ingest_cv_detections_for_evidence(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    evidence_id: str = Path(..., description="Unique ID of the target video evidence"),
    payload: VideoAnalysisPayload = ...,
) -> VideoAnalysisResponse:
    """Ingest CV results where source_id is confirmed against route parameter."""
    if payload.source_id != evidence_id:
        # Align source_id with path parameter if convenient for caller
        payload = payload.model_copy(update={"source_id": evidence_id})
    return video_analysis_service.process_detection_results(
        incident_id=incident_id, detection_data=payload
    )


@router.post(
    "/incidents/{incident_id}/evidence/{evidence_id}/analyze-video",
    response_model=VideoAnalysisResponse,
    summary="Execute computer vision and physics analysis on stored video evidence",
    description=(
        "Executes YOLOv8 vehicle detection, ByteTrack tracking, trajectory extraction, "
        "and 2D kinematic reasoning on the stored video file. Generates structured JSON analysis, "
        "annotated video, and trajectory plot artifacts, and indexes normalized observation events in SQLite."
    ),
    tags=["Video & Computer Vision Analysis"],
)
async def analyze_video_evidence(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    evidence_id: str = Path(..., description="Unique ID of the target video evidence"),
) -> VideoAnalysisResponse:
    """Analyze stored video evidence through the end-to-end computer-vision pipeline."""
    return await video_analysis_service.analyze_video_evidence(
        incident_id=incident_id, evidence_id=evidence_id
    )


@router.post(
    "/incidents/{incident_id}/evidence/{evidence_id}/video-llm-analysis",
    summary="Generate or re-synthesize LLM forensic interpretation for video evidence",
    description="Invokes LLM synthesis on stored video tracks, kinematics, and driver claims without determining fault.",
    tags=["Video & Computer Vision Analysis"],
)
async def generate_video_llm_analysis(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    evidence_id: str = Path(..., description="Unique ID of the target video evidence"),
):
    """Generate or retrieve LLM forensic synthesis for video observations."""
    from app.database import list_analysis_runs_for_incident
    runs = list_analysis_runs_for_incident(incident_id)
    for r in runs:
        if r.run_type == "video_llm_analysis" and r.findings:
            return r.findings

    # If not yet generated, execute video analysis which generates LLM synthesis
    res = await video_analysis_service.analyze_video_evidence(incident_id=incident_id, evidence_id=evidence_id)
    return res.llm_analysis


@router.post(
    "/incidents/{incident_id}/analyze-video",
    response_model=VideoAnalysisResponse,
    summary="Upload and analyze accident video through computer vision pipeline in one step",
    description=(
        "Accepts a multipart video file upload (MP4, AVI, MOV), securely saves it to bounded incident storage, "
        "and executes the full CV pipeline: YOLOv8 vehicle detection, ByteTrack tracking, trajectory extraction, "
        "and physics reasoning."
    ),
    tags=["Video & Computer Vision Analysis"],
)
async def upload_and_analyze_video(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    file: UploadFile = File(..., description="Video file to upload and analyze"),
    party_id: Optional[str] = Form(None, description="Optional ID of associated party (V1 or V2)"),
) -> VideoAnalysisResponse:
    """Upload video file and immediately execute computer vision analysis pipeline."""
    from app.services.evidence_service import evidence_service

    saved_evidence = await evidence_service.save_uploaded_file(
        incident_id=incident_id,
        file=file,
        evidence_type="DASHCAM_VIDEO",
        party_id=party_id,
    )
    return await video_analysis_service.analyze_video_evidence(
        incident_id=incident_id, evidence_id=saved_evidence.id
    )


# ============================================================================
# TIMELINE ENGINE ENDPOINTS
# ============================================================================

@router.get(
    "/incidents/{incident_id}/timeline",
    response_model=TimelineResponse,
    summary="Retrieve multi-modal reconstructed incident timeline",
    description=(
        "Synthesizes normalized events across witness statements, video detections, and sensor processing. "
        "Orders events chronologically, preserves timestamp precision, keeps video-relative offsets separate "
        "from real-world UTC time unless synchronized, and groups events into occurrences with adequate supporting information."
    ),
    tags=["Timeline Engine"],
)
async def get_incident_timeline(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    group_occurrences: bool = Query(default=True, description="Whether to cluster correlated events into occurrences"),
) -> TimelineResponse:
    """Retrieve chronologically reconstructed timeline for an incident."""
    req = TimelineSyncRequest(group_occurrences=group_occurrences)
    return timeline_engine_service.build_timeline(incident_id=incident_id, sync_request=req)


@router.post(
    "/incidents/{incident_id}/timeline",
    response_model=TimelineResponse,
    summary="Retrieve incident timeline with explicit video synchronization offsets",
    description=(
        "Constructs the chronological timeline mapping video-relative offsets to real-world UTC "
        "when explicit synchronization offsets are supplied for video evidence."
    ),
    tags=["Timeline Engine"],
)
async def get_incident_timeline_synchronized(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    sync_request: TimelineSyncRequest = ...,
) -> TimelineResponse:
    """Retrieve timeline applying explicit video wall-clock synchronization offsets."""
    return timeline_engine_service.build_timeline(incident_id=incident_id, sync_request=sync_request)


# ============================================================================
# CONTRADICTION ENGINE ENDPOINTS
# ============================================================================

@router.get(
    "/incidents/{incident_id}/contradictions",
    response_model=ContradictionEngineResponse,
    summary="Retrieve and evaluate factual contradictions across claims and observations",
    description=(
        "Evaluates witness claims against sensor telemetry, video detections, and peer claims. "
        "Distinguishes direct contradictions from missing evidence and wording differences. "
        "Preserves unresolved conflicts objectively without labeling witnesses truthful or deceptive."
    ),
    tags=["Contradiction Engine"],
)
async def get_incident_contradictions(
    incident_id: str = Path(..., description="Unique ID of the incident"),
) -> ContradictionEngineResponse:
    """Detect and evaluate contradictions for an incident."""
    return contradiction_engine_service.analyze_contradictions(incident_id=incident_id)


@router.post(
    "/incidents/{incident_id}/detect-contradictions",
    response_model=ContradictionEngineResponse,
    summary="Trigger contradiction detection and claim verification",
    tags=["Contradiction Engine"],
)
async def trigger_detect_contradictions(
    incident_id: str = Path(..., description="Unique ID of the incident"),
) -> ContradictionEngineResponse:
    """Trigger contradiction analysis and persist findings."""
    return contradiction_engine_service.analyze_contradictions(incident_id=incident_id)


# ============================================================================
# INVESTIGATION WORKFLOW ENDPOINTS
# ============================================================================

@router.get(
    "/incidents/{incident_id}/investigate",
    response_model=InvestigationWorkflowResponse,
    summary="Retrieve automated investigation workflow status and findings",
    tags=["Investigation Workflow"],
)
async def get_incident_investigation(
    incident_id: str = Path(..., description="Unique ID of the incident"),
) -> InvestigationWorkflowResponse:
    """Run or retrieve automated investigation status for an incident."""
    return await investigation_engine_service.run_investigation(incident_id=incident_id)


@router.post(
    "/incidents/{incident_id}/investigate",
    response_model=InvestigationWorkflowResponse,
    summary="Trigger end-to-end automated investigation pipeline",
    tags=["Investigation Workflow"],
)
async def trigger_incident_investigation(
    incident_id: str = Path(..., description="Unique ID of the incident"),
) -> InvestigationWorkflowResponse:
    """Coordinate the full investigation pipeline across statements, telemetry, and video."""
    return await investigation_engine_service.run_investigation(incident_id=incident_id)


# ============================================================================
# REPORT GENERATION ENDPOINTS
# ============================================================================

@router.get(
    "/incidents/{incident_id}/report",
    response_model=InvestigationReportResponse,
    summary="Generate or retrieve structured forensic investigation report",
    description=(
        "Produces a 10-section structured forensic report synthesizing incident summary, "
        "original party statements, chronological timeline, video frame references, "
        "sensor row references, conflicting claims, supporting evidence, unresolved questions, "
        "and evidentiary limitations without declaring legal fault."
    ),
    tags=["Investigation Report"],
)
async def get_incident_report(
    incident_id: str = Path(..., description="Unique ID of the incident"),
    refresh: bool = Query(default=False, description="Force re-generation of the report instead of returning cached report"),
) -> InvestigationReportResponse:
    """Retrieve existing report or generate a new one if none exists or refresh requested."""
    if not refresh:
        existing = get_latest_report_for_incident(incident_id)
        if existing and "report_data" in existing:
            try:
                return InvestigationReportResponse.model_validate(existing["report_data"])
            except Exception:
                pass  # Fall through to generate fresh report if validation fails

    return await report_generator_service.generate_report(incident_id=incident_id)


@router.post(
    "/incidents/{incident_id}/report",
    response_model=InvestigationReportResponse,
    summary="Trigger new forensic investigation report generation",
    tags=["Investigation Report"],
)
async def generate_incident_report(
    incident_id: str = Path(..., description="Unique ID of the incident"),
) -> InvestigationReportResponse:
    """Generate and store a new investigation report."""
    return await report_generator_service.generate_report(incident_id=incident_id)


