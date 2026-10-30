from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4
from pydantic import BaseModel, Field

from app.models.enums import AnalysisRunStatus


class AnalysisRunBase(BaseModel):
    """Base schema for an analytical reconstruction run."""

    run_type: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Type of analysis performed (e.g. timeline_reconstruction, contradiction_detection, speed_estimation)",
        examples=["timeline_reconstruction"],
    )
    status: AnalysisRunStatus = Field(
        default=AnalysisRunStatus.QUEUED,
        description="Execution status of this analysis run",
    )
    summary: Optional[str] = Field(
        default=None,
        description="Executive summary of the run results",
    )
    findings: Dict[str, Any] = Field(
        default_factory=dict,
        description="Structured key-value findings and metrics",
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error details if the analysis failed",
    )


class AnalysisRunCreate(AnalysisRunBase):
    """Schema for registering a new analysis run."""

    incident_id: str = Field(..., description="Foreign key of the associated incident")
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AnalysisRunUpdate(BaseModel):
    """Schema for updating an analysis run status and results."""

    status: Optional[AnalysisRunStatus] = None
    completed_at: Optional[datetime] = None
    summary: Optional[str] = None
    findings: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class AnalysisRunResponse(AnalysisRunBase):
    """Schema for analysis run responses."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
