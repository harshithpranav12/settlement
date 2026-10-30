"""Pydantic models for deterministic vehicle and sensor telemetry analysis."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field


class SensorRowValidationError(BaseModel):
    """Details of a malformed or invalid row in a sensor CSV."""

    row_number: int = Field(..., description="1-indexed line number in the source CSV")
    column: str = Field(..., description="Column containing the invalid data")
    raw_value: Any = Field(..., description="The unparseable raw value")
    error_message: str = Field(..., description="Explanation of validation failure")


class SensorAnomalyOrPattern(BaseModel):
    """An observable kinematic pattern detected in sensor telemetry."""

    pattern_type: str = Field(
        ...,
        description="Type of kinematic pattern (e.g. rapid_deceleration, vehicle_stopped, sensor_data_gap, rapid_acceleration)",
        examples=["rapid_deceleration"],
    )
    description: str = Field(
        ...,
        description="Objective description of observed behavior without premature collision inference",
    )
    vehicle_id: str = Field(
        ...,
        description="Vehicle or party identifier associated with the measurement",
    )
    row_start: int = Field(..., description="Source CSV starting row number")
    row_end: Optional[int] = Field(default=None, description="Source CSV ending row number")
    timestamp_start: Optional[datetime] = Field(
        default=None,
        description="Real-world UTC timestamp if format and timezone were verified",
    )
    timestamp_end: Optional[datetime] = Field(
        default=None,
        description="End of UTC interval if known",
    )
    relative_time_start: Optional[float] = Field(
        default=None,
        description="Elapsed relative time in seconds from start of telemetry recording",
    )
    relative_time_end: Optional[float] = Field(
        default=None,
        description="End of elapsed relative time in seconds",
    )
    metrics: Dict[str, Any] = Field(
        default_factory=dict,
        description="Computed observable metrics (e.g. delta_speed_kmh, max_deceleration_ms2, gap_duration_sec)",
    )


class SensorAnalysisResponse(BaseModel):
    """Structured response for sensor and telematics analysis."""

    analysis_id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    evidence_id: str
    source_filename: str
    total_rows_read: int
    valid_samples_count: int
    malformed_rows_count: int
    malformed_row_errors: List[SensorRowValidationError] = Field(default_factory=list)
    patterns_detected: List[SensorAnomalyOrPattern] = Field(default_factory=list)
    extracted_event_ids: List[str] = Field(default_factory=list)
    summary: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}
