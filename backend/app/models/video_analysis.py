"""Pydantic schemas for computer-vision video analysis results ingestion.

Supports object detections, image-plane trajectories, 2D motion reasoning,
and spatial-temporal interaction patterns.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4
from pydantic import BaseModel, Field, field_validator, model_validator


class BoundingBoxCoordinates(BaseModel):
    """Bounding box pixel coordinates with strict geometric validation."""

    x_min: float = Field(
        ...,
        description="Top-left x coordinate in pixel space (0 <= x_min < x_max)",
        examples=[100.0],
    )
    y_min: float = Field(
        ...,
        description="Top-left y coordinate in pixel space (0 <= y_min < y_max)",
        examples=[200.0],
    )
    x_max: float = Field(
        ...,
        description="Bottom-right x coordinate in pixel space",
        examples=[350.0],
    )
    y_max: float = Field(
        ...,
        description="Bottom-right y coordinate in pixel space",
        examples=[450.0],
    )

    @field_validator("x_min", "y_min", "x_max", "y_max", mode="before")
    @classmethod
    def parse_float(cls, v: Any) -> float:
        try:
            return float(v)
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Coordinate value must be a valid float, got '{v}'") from exc

    @model_validator(mode="before")
    @classmethod
    def normalize_input(cls, data: Any) -> Any:
        """Allow list/tuple [x_min, y_min, x_max, y_max] or alternate dict keys."""
        if isinstance(data, (list, tuple)):
            if len(data) != 4:
                raise ValueError(
                    f"Bounding box list must contain exactly 4 coordinates [x_min, y_min, x_max, y_max], got {len(data)}"
                )
            return {"x_min": data[0], "y_min": data[1], "x_max": data[2], "y_max": data[3]}
        elif isinstance(data, dict):
            # Normalize alternative key spellings (xmin, ymin, xmax, ymax)
            normalized = dict(data)
            if "xmin" in normalized and "x_min" not in normalized:
                normalized["x_min"] = normalized["xmin"]
            if "ymin" in normalized and "y_min" not in normalized:
                normalized["y_min"] = normalized["ymin"]
            if "xmax" in normalized and "x_max" not in normalized:
                normalized["x_max"] = normalized["xmax"]
            if "ymax" in normalized and "y_max" not in normalized:
                normalized["y_max"] = normalized["ymax"]
            # Convert [x, y, width, height] format
            if "width" in normalized and "x" in normalized and "x_max" not in normalized:
                normalized["x_min"] = normalized["x"]
                normalized["x_max"] = normalized["x"] + normalized["width"]
            if "height" in normalized and "y" in normalized and "y_max" not in normalized:
                normalized["y_min"] = normalized["y"]
                normalized["y_max"] = normalized["y"] + normalized["height"]
            return normalized
        return data

    @model_validator(mode="after")
    def validate_geometry(self) -> "BoundingBoxCoordinates":
        """Enforce non-negative bounds and positive dimensions."""
        if self.x_min < 0 or self.y_min < 0:
            raise ValueError(
                f"Bounding box coordinates must be non-negative: x_min={self.x_min}, y_min={self.y_min}"
            )
        if self.x_min >= self.x_max:
            raise ValueError(
                f"x_min ({self.x_min}) must be strictly less than x_max ({self.x_max})"
            )
        if self.y_min >= self.y_max:
            raise ValueError(
                f"y_min ({self.y_min}) must be strictly less than y_max ({self.y_max})"
            )
        return self

    @property
    def center_pixel_x(self) -> float:
        return (self.x_min + self.x_max) / 2.0

    @property
    def center_pixel_y(self) -> float:
        return (self.y_min + self.y_max) / 2.0

    @property
    def width_pixels(self) -> float:
        return self.x_max - self.x_min

    @property
    def height_pixels(self) -> float:
        return self.y_max - self.y_min


class DetectionItem(BaseModel):
    """Single-frame detection result from the vision pipeline."""

    vehicle_id: str = Field(
        ...,
        min_length=1,
        description="Algorithm-assigned track identifier (e.g. 'TRACK_1'); NOT a verified real-world vehicle identity",
        examples=["TRACK_1"],
    )
    class_name: str = Field(
        ...,
        alias="class",
        min_length=1,
        description="Vision classification label (e.g. 'car', 'truck', 'motorcycle', 'bus', 'pedestrian')",
        examples=["car"],
    )
    timestamp_seconds: float = Field(
        ...,
        ge=0.0,
        description="Video-relative timestamp in seconds (must be non-negative)",
        examples=[10.5],
    )
    frame_number: int = Field(
        ...,
        ge=0,
        description="Video frame index (must be non-negative)",
        examples=[315],
    )
    bbox: BoundingBoxCoordinates = Field(
        ...,
        description="Bounding box pixel coordinates (supports [x_min, y_min, x_max, y_max] or {x, y, width, height})",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Detector confidence score between 0.0 and 1.0",
        examples=[0.91],
    )

    model_config = {
        "populate_by_name": True,
        "from_attributes": True,
    }


class TrajectoryInputPoint(BaseModel):
    """Explicit trajectory point provided by the CV pipeline."""

    timestamp_seconds: float = Field(..., ge=0.0, description="Video offset in seconds")
    frame_number: int = Field(..., ge=0, description="Video frame number")
    center_x: float = Field(..., description="Center X in pixel space")
    center_y: float = Field(..., description="Center Y in pixel space")


class TrajectorySequenceInput(BaseModel):
    """Tracked vehicle trajectory sequence from CV physics/motion analysis."""

    vehicle_id: str = Field(..., min_length=1)
    points: List[TrajectoryInputPoint] = Field(default_factory=list)


class MotionAnalysisItem(BaseModel):
    """Image-plane 2D motion and acceleration trend analysis."""

    vehicle_id: str = Field(..., min_length=1)
    velocity_trend: Optional[str] = Field(
        default=None,
        description="Observable velocity trend (e.g. increasing, decreasing, constant, stopped)",
        examples=["increasing"],
    )
    acceleration_trend: Optional[str] = Field(
        default=None,
        description="Observable acceleration direction (e.g. positive, negative, neutral)",
        examples=["positive"],
    )
    velocity_unit: Optional[str] = Field(
        default="pixels_per_second",
        description="Unit of image-plane velocity",
        examples=["pixels_per_second"],
    )
    acceleration_unit: Optional[str] = Field(
        default="pixels_per_second_squared",
        description="Unit of image-plane acceleration",
        examples=["pixels_per_second_squared"],
    )
    sudden_motion_change: bool = Field(
        default=False,
        description="Flag indicating sudden 2D velocity or acceleration inflection",
    )
    analysis_notes: Optional[str] = Field(
        default=None,
        description="Qualitative summary of image-plane kinematic behavior",
        examples=["Vehicle shows increasing image-plane movement."],
    )


class PossibleInteractionItem(BaseModel):
    """Spatial-temporal interaction observed between multiple tracks in image space."""

    vehicle_ids: List[str] = Field(
        ...,
        min_length=2,
        description="Track IDs involved in the spatial-temporal interaction",
        examples=[["TRACK_1", "TRACK_2"]],
    )
    timestamp_seconds: float = Field(
        ...,
        ge=0.0,
        description="Video-relative timestamp when interaction occurred",
        examples=[10.8],
    )
    finding: str = Field(
        ...,
        description="Identified pattern (e.g. possible_path_convergence, proximity_warning, abrupt_trajectory_deviation)",
        examples=["possible_path_convergence"],
    )
    min_image_distance_pixels: Optional[float] = Field(
        default=None,
        description="Closest 2D separation distance in image pixels (does NOT represent physical meters)",
        examples=[35.0],
    )
    evidence_frame_numbers: List[int] = Field(
        default_factory=list,
        description="Frame numbers associated with the interaction window",
        examples=[[324, 325, 326]],
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Confidence score for this interaction observation",
        examples=[0.72],
    )


class VideoAnalysisPayload(BaseModel):
    """Contract payload submitted by the computer-vision module."""

    source_id: str = Field(
        ...,
        min_length=1,
        description="Evidence ID of the original video uploaded to the incident",
    )
    video_fps: float = Field(
        ...,
        gt=0.0,
        description="Video frame rate in frames per second",
        examples=[30.0],
    )
    frame_width: int = Field(
        ...,
        gt=0,
        description="Frame pixel width",
        examples=[1280],
    )
    frame_height: int = Field(
        ...,
        gt=0,
        description="Frame pixel height",
        examples=[720],
    )
    detections: List[DetectionItem] = Field(
        default_factory=list,
        description="List of detected object bounding boxes across video frames",
    )
    trajectories: Optional[List[TrajectorySequenceInput]] = Field(
        default_factory=list,
        description="Optional pre-computed trajectory point sequences from CV module",
    )
    motion_analysis: Optional[List[MotionAnalysisItem]] = Field(
        default_factory=list,
        description="Optional image-plane kinematic trend reasoning",
    )
    possible_interactions: Optional[List[PossibleInteractionItem]] = Field(
        default_factory=list,
        description="Optional multi-track interaction patterns (path convergence, proximity)",
    )

    @model_validator(mode="after")
    def validate_frame_boundaries(self) -> "VideoAnalysisPayload":
        """Verify that all bounding boxes fall within the reported frame width and height."""
        for i, det in enumerate(self.detections):
            if det.bbox.x_max > self.frame_width:
                raise ValueError(
                    f"Detection at index {i} (vehicle_id='{det.vehicle_id}') bbox x_max ({det.bbox.x_max}) "
                    f"exceeds frame_width ({self.frame_width})"
                )
            if det.bbox.y_max > self.frame_height:
                raise ValueError(
                    f"Detection at index {i} (vehicle_id='{det.vehicle_id}') bbox y_max ({det.bbox.y_max}) "
                    f"exceeds frame_height ({self.frame_height})"
                )
        return self


class TrajectoryPoint(BaseModel):
    """Single point in a vehicle's pixel-space trajectory sequence."""

    frame_number: int
    timestamp_seconds: float
    center_pixel_x: float = Field(
        ...,
        description="Center X in pixel coordinates (strictly distinct from geographic coordinates)",
    )
    center_pixel_y: float = Field(
        ...,
        description="Center Y in pixel coordinates (strictly distinct from geographic coordinates)",
    )
    bbox_width_pixels: Optional[float] = None
    bbox_height_pixels: Optional[float] = None
    confidence: Optional[float] = None


class VehicleTrack(BaseModel):
    """Sequence of detections forming a continuous tracked trajectory."""

    vehicle_id: str = Field(
        ...,
        description="Algorithm-assigned tracking ID; not verified real-world vehicle identity",
    )
    tracking_label: str = Field(
        ...,
        description="Explicit note stating this is an unverified algorithmic track",
    )
    detected_class: str
    first_frame: int
    last_frame: int
    first_timestamp_seconds: float
    last_timestamp_seconds: float
    duration_seconds: float
    detection_count: int
    average_confidence: float
    trajectory: List[TrajectoryPoint] = Field(default_factory=list)
    motion_summary: Optional[MotionAnalysisItem] = None


class VideoAnalysisResponse(BaseModel):
    """Structured response from video analysis ingestion."""

    analysis_id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    source_id: str
    video_fps: float
    frame_width: int
    frame_height: int
    total_detections: int
    tracked_vehicles_count: int
    vehicle_tracks: List[VehicleTrack] = Field(default_factory=list)
    motion_analysis: List[MotionAnalysisItem] = Field(default_factory=list)
    possible_interactions: List[PossibleInteractionItem] = Field(default_factory=list)
    extracted_event_ids: List[str] = Field(default_factory=list)
    summary: str
    disclaimer: str = Field(
        default=(
            "Algorithm-generated visual tracking and 2D image-plane motion analysis represent machine-vision observations. "
            "A bounding box observation or image-plane proximity does not establish calibrated speed, "
            "fault, collision, or legal responsibility."
        ),
        description="Legal and forensic disclaimer",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}
