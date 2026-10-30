from enum import Enum


class PartyLabel(str, Enum):
    """Accident party designator strictly limited to V1 or V2."""

    V1 = "V1"
    V2 = "V2"


class IncidentStatus(str, Enum):
    """Lifecycle status of an accident incident investigation."""

    CREATED = "created"
    EVIDENCE_COLLECTED = "evidence_collected"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    # Investigation workflow states
    AWAITING_INITIAL_STATEMENTS = "awaiting_initial_statements"
    AWAITING_EVIDENCE = "awaiting_evidence"
    PROCESSING = "processing"
    READY_FOR_REVIEW = "ready_for_review"
    FAILED = "failed"


class InvestigationStatus(str, Enum):
    """Status of an automated investigation workflow run."""

    AWAITING_INITIAL_STATEMENTS = "awaiting_initial_statements"
    AWAITING_EVIDENCE = "awaiting_evidence"
    PROCESSING = "processing"
    READY_FOR_REVIEW = "ready_for_review"
    FAILED = "failed"


class EvidenceType(str, Enum):
    """Categorization of submitted evidence."""

    DASHCAM_VIDEO = "dashcam_video"
    CCTV_VIDEO = "cctv_video"
    WITNESS_STATEMENT = "witness_statement"
    POLICE_REPORT = "police_report"
    PHOTO = "photo"
    TELEMATICS = "telematics"
    GPS_LOG = "gps_log"
    OTHER = "other"


class ProcessingStatus(str, Enum):
    """Processing state for evidence pipelines."""

    UPLOADED = "uploaded"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    # Aliases preserved for backward compatibility
    PENDING = "pending"
    PROCESSED = "processed"


class EventClassification(str, Enum):
    """Epistemic classification of an extracted event or claim."""

    OBSERVATION = "observation"  # Directly observed in sensor/video data
    CLAIM = "claim"              # Stated by an involved party or witness
    INFERENCE = "inference"      # Deduced algorithmically or forensically


class ContradictionSeverity(str, Enum):
    """Impact severity of an identified timeline contradiction."""

    MINOR = "minor"
    MODERATE = "moderate"
    CRITICAL = "critical"


class ContradictionStatus(str, Enum):
    """Resolution status of a contradiction."""

    DETECTED = "detected"
    UNDER_REVIEW = "under_review"
    UNRESOLVED = "unresolved"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class EvidenceRequestStatus(str, Enum):
    """Status of an investigator's request for additional evidence."""

    PENDING = "pending"
    FULFILLED = "fulfilled"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    DISMISSED = "dismissed"


class AnalysisRunStatus(str, Enum):
    """Status of an analysis pipeline execution."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
