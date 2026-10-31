"""API routes for interactive AI investigator assistant and Featherless AI proxy."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from featherless_client import featherless_client

router = APIRouter()


class StatementAnalysisRequest(BaseModel):
    statement: str = Field(..., description="Uploaded or transcribed witness statement text")
    witnessId: Optional[str] = "WIT-UNKNOWN"
    witnessName: Optional[str] = "Witness"
    witnessRole: Optional[str] = "Observer"
    incidentId: Optional[str] = "INC-2026-0884"


class EventCorrelationRequest(BaseModel):
    candidateEvent: Dict[str, Any] = Field(..., description="Extracted candidate event object")
    timelineEvents: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="List of deterministic timeline events")
    telemetrySummary: Optional[Dict[str, Any]] = Field(default=None, description="Summary of empirical vehicle telemetry")


class ContradictionRequest(BaseModel):
    contradiction: Dict[str, Any] = Field(..., description="Detected contradiction object")


class InvestigatorChatRequest(BaseModel):
    query: str = Field(..., description="Forensic question asked by the investigator")
    incidentContext: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Incident context including telemetry, timeline, and contradictions")
    chatHistory: Optional[List[Dict[str, str]]] = Field(default_factory=list, description="Previous conversation turns")


class InvestigationSummaryRequest(BaseModel):
    incidentContext: Dict[str, Any] = Field(..., description="Comprehensive incident context object")


class EvidenceSummaryRequest(BaseModel):
    evidenceItems: List[Dict[str, Any]] = Field(..., description="List of ingested evidence items")


@router.get("/health", tags=["AI Investigator"])
@router.get("/status", tags=["AI Investigator"])
def get_ai_status() -> Dict[str, Any]:
    """Returns the real-time configuration status of the Featherless AI proxy, active model, and fallback readiness."""
    return featherless_client.get_status()


@router.post("/analyze-statement", tags=["AI Investigator"])
def analyze_witness_statement(req: StatementAnalysisRequest) -> Dict[str, Any]:
    """Analyzes witness statement with prompt-injection defenses and structured event extraction."""
    try:
        return featherless_client.analyze_witness_statement(
            statement=req.statement,
            witness_id=req.witnessId or "WIT-UNKNOWN",
            witness_name=req.witnessName or "Witness",
            witness_role=req.witnessRole or "Observer",
            incident_id=req.incidentId or "INC-2026-0884",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Statement analysis error: {str(e)}")


@router.post("/correlate-event", tags=["AI Investigator"])
def correlate_event(req: EventCorrelationRequest) -> Dict[str, Any]:
    """Cross-references candidate event against deterministic timeline events."""
    try:
        return featherless_client.correlate_event(
            candidate_event=req.candidateEvent,
            timeline_events=req.timelineEvents or [],
            telemetry_summary=req.telemetrySummary,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Event correlation error: {str(e)}")


@router.post("/explain-contradiction", tags=["AI Investigator"])
def explain_contradiction(req: ContradictionRequest) -> Dict[str, Any]:
    """Explains detected contradiction using Featherless AI with forensic guardrails."""
    try:
        return featherless_client.explain_contradiction(req.contradiction)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contradiction explanation error: {str(e)}")


@router.post("/investigator-chat", tags=["AI Investigator"])
def investigator_chat(req: InvestigatorChatRequest) -> Dict[str, Any]:
    """Interactive AI investigator assistant answering incident queries strictly grounded in evidence."""
    try:
        return featherless_client.investigator_chat(
            query=req.query,
            incident_context=req.incidentContext or {},
            chat_history=req.chatHistory or [],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Investigator chat error: {str(e)}")


@router.post("/generate-summary", tags=["AI Investigator"])
def generate_investigation_summary(req: InvestigationSummaryRequest) -> Dict[str, Any]:
    """Generates narrative forensic report summary for review and acceptance."""
    try:
        return featherless_client.generate_investigation_summary(
            incident_context=req.incidentContext
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summary generation error: {str(e)}")


@router.post("/summarize-evidence", tags=["AI Investigator"])
def summarize_evidence(req: EvidenceSummaryRequest) -> Dict[str, Any]:
    """Summarizes supporting evidentiary streams without inventing facts."""
    try:
        return featherless_client.summarize_evidence(req.evidenceItems)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evidence summarization error: {str(e)}")
