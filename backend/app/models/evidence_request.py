from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4
from pydantic import BaseModel, Field, model_validator

from app.models.enums import EvidenceRequestStatus


class EvidenceRequestBase(BaseModel):
    """Base schema for an evidence request in an incident investigation."""

    request_type: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Type of evidence being requested",
        examples=["cctv_footage", "dashcam_video", "driver_statement", "telematics_data"],
    )
    description: str = Field(
        ...,
        min_length=1,
        description="Specific instructions or scope of the requested evidence",
        examples=["Request municipal traffic camera footage between 14:10 and 14:20 UTC."],
    )
    reason: Optional[str] = Field(
        default=None,
        description="Forensic rationale for why this evidence is requested",
    )
    related_conflict_or_question: Optional[str] = Field(
        default=None,
        description="Related conflict or unresolved question this evidence aims to resolve",
    )
    priority: str = Field(
        default="medium",
        description="Priority level: critical, high, medium, low",
    )
    target_party: Optional[str] = Field(
        default=None,
        description="Party or authority from whom evidence is requested (e.g. V1, V2, Traffic Police)",
        examples=["V1", "City Traffic Department"],
    )
    status: EvidenceRequestStatus = Field(
        default=EvidenceRequestStatus.PENDING,
        description="Current fulfillment status",
    )
    fulfilled_evidence_id: Optional[str] = Field(
        default=None,
        description="ID of the evidence record that satisfied this request",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Map requested_evidence_type to request_type if present
            if "requested_evidence_type" in data and "request_type" not in data:
                data["request_type"] = data["requested_evidence_type"]
            # Map reason to description if description not provided
            if "reason" in data and ("description" not in data or not data["description"]):
                data["description"] = data["reason"]
            elif "description" in data and ("reason" not in data or not data["reason"]):
                data["reason"] = data["description"]
        return data


class EvidenceRequestCreate(EvidenceRequestBase):
    """Schema for creating a new evidence request."""

    incident_id: str = Field(..., description="Foreign key of the associated incident")


class EvidenceRequestUpdate(BaseModel):
    """Schema for updating evidence request status."""

    status: Optional[EvidenceRequestStatus] = None
    fulfilled_evidence_id: Optional[str] = None
    description: Optional[str] = None
    reason: Optional[str] = None
    priority: Optional[str] = None


class EvidenceRequestResponse(EvidenceRequestBase):
    """Schema for returning evidence request details."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    request_id: Optional[str] = None
    requested_evidence_type: Optional[str] = None
    incident_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="before")
    @classmethod
    def populate_response_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_id = data.get("id") or data.get("request_id")
            if raw_id:
                data["id"] = raw_id
                data["request_id"] = raw_id
            req_type = data.get("request_type") or data.get("requested_evidence_type")
            if req_type:
                data["request_type"] = req_type
                data["requested_evidence_type"] = req_type
            if "description" in data and not data.get("reason"):
                data["reason"] = data["description"]
        return data

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }
