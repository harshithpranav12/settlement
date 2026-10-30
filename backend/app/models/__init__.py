"""Pydantic data models for request and response validation."""

from app.models.enums import (
    AnalysisRunStatus,
    ContradictionSeverity,
    ContradictionStatus,
    EventClassification,
    EvidenceRequestStatus,
    EvidenceType,
    IncidentStatus,
    InvestigationStatus,
    PartyLabel,
    ProcessingStatus,
)
from app.models.health import HealthResponse
from app.models.party import (
    PartyBase,
    PartyCreate,
    PartyResponse,
    PartyUpdate,
)
from app.models.evidence import (
    EvidenceBase,
    EvidenceCreate,
    EvidenceResponse,
    EvidenceUpdate,
    WitnessStatementCreate,
)
from app.models.event import (
    ExtractedEventBase,
    ExtractedEventCreate,
    ExtractedEventResponse,
    ExtractedEventUpdate,
)
from app.models.contradiction import (
    ContradictionBase,
    ContradictionCreate,
    ContradictionResponse,
    ContradictionUpdate,
)
from app.models.evidence_request import (
    EvidenceRequestBase,
    EvidenceRequestCreate,
    EvidenceRequestResponse,
    EvidenceRequestUpdate,
)
from app.models.analysis_run import (
    AnalysisRunBase,
    AnalysisRunCreate,
    AnalysisRunResponse,
    AnalysisRunUpdate,
)
from app.models.incident import (
    IncidentBase,
    IncidentCreate,
    IncidentDetailResponse,
    IncidentResponse,
    IncidentUpdate,
)
from app.models.sensor_analysis import (
    SensorAnalysisResponse,
    SensorAnomalyOrPattern,
    SensorRowValidationError,
)
from app.models.statement_analysis import (
    ClaimConflict,
    CompatibleClaim,
    ExtractedClaim,
    GeneratedEvidenceRequest,
    StatementAnalysisLLMOutput,
    StatementAnalysisResponse,
    UnresolvedQuestion,
)
from app.models.investigation import InvestigationWorkflowResponse
from app.models.report import (
    EvidenceFindingRef,
    InvestigationReportResponse,
    PartyStatementRecord,
    SensorObservationRef,
    VideoObservationRef,
)
from app.models.timeline import (
    TimePrecision,
    TimelineItem,
    TimelineOccurrence,
    TimelineResponse,
    TimelineSyncRequest,
    TimelineTimeType,
    VideoTrackTimeline,
)
from app.models.contradiction_engine import (
    CompatibleStatementItem,
    ConflictType,
    ContradictionEngineResponse,
    ContradictionFinding,
    MissingEvidenceItem,
)
from app.models.video_analysis import (
    BoundingBoxCoordinates,
    DetectionItem,
    MotionAnalysisItem,
    PossibleInteractionItem,
    TrajectoryInputPoint,
    TrajectoryPoint,
    TrajectorySequenceInput,
    VehicleTrack,
    VideoAnalysisPayload,
    VideoAnalysisResponse,
)

__all__ = [
    # Enums
    "AnalysisRunStatus",
    "ContradictionSeverity",
    "ContradictionStatus",
    "EventClassification",
    "EvidenceRequestStatus",
    "EvidenceType",
    "IncidentStatus",
    "InvestigationStatus",
    "PartyLabel",
    "ProcessingStatus",
    # Health
    "HealthResponse",
    # Incident
    "IncidentBase",
    "IncidentCreate",
    "IncidentDetailResponse",
    "IncidentResponse",
    "IncidentUpdate",
    # Party
    "PartyBase",
    "PartyCreate",
    "PartyResponse",
    "PartyUpdate",
    # Evidence
    "EvidenceBase",
    "EvidenceCreate",
    "EvidenceResponse",
    "EvidenceUpdate",
    "WitnessStatementCreate",
    # Extracted Event
    "ExtractedEventBase",
    "ExtractedEventCreate",
    "ExtractedEventResponse",
    "ExtractedEventUpdate",
    # Contradiction
    "ContradictionBase",
    "ContradictionCreate",
    "ContradictionResponse",
    "ContradictionUpdate",
    # Evidence Request
    "EvidenceRequestBase",
    "EvidenceRequestCreate",
    "EvidenceRequestResponse",
    "EvidenceRequestUpdate",
    # Analysis Run
    "AnalysisRunBase",
    "AnalysisRunCreate",
    "AnalysisRunResponse",
    "AnalysisRunUpdate",
    # Statement Analysis
    "ClaimConflict",
    "CompatibleClaim",
    "ExtractedClaim",
    "GeneratedEvidenceRequest",
    "StatementAnalysisLLMOutput",
    "StatementAnalysisResponse",
    "UnresolvedQuestion",
    # Sensor Analysis
    "SensorAnalysisResponse",
    "SensorAnomalyOrPattern",
    "SensorRowValidationError",
    # Video Analysis
    "BoundingBoxCoordinates",
    "DetectionItem",
    "MotionAnalysisItem",
    "PossibleInteractionItem",
    "TrajectoryInputPoint",
    "TrajectoryPoint",
    "TrajectorySequenceInput",
    "VehicleTrack",
    "VideoAnalysisPayload",
    "VideoAnalysisResponse",
    # Timeline
    "TimePrecision",
    "TimelineItem",
    "TimelineOccurrence",
    "TimelineResponse",
    "TimelineSyncRequest",
    "TimelineTimeType",
    "VideoTrackTimeline",
    # Contradiction Engine
    "CompatibleStatementItem",
    "ConflictType",
    "ContradictionEngineResponse",
    "ContradictionFinding",
    "MissingEvidenceItem",
    # Investigation Workflow
    "InvestigationWorkflowResponse",
    # Report
    "EvidenceFindingRef",
    "InvestigationReportResponse",
    "PartyStatementRecord",
    "SensorObservationRef",
    "VideoObservationRef",
]
