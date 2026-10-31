import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from featherless_client import featherless_client

app = FastAPI(
    title="TRACE AI Forensic Investigation Backend",
    description="Deterministic cross-examination engine and Featherless AI forensic synthesis proxy",
    version="1.0.0"
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Endpoints (Synchronous for optimal stability across all Windows Python versions)
# ---------------------------------------------------------------------------
@app.get("/api/v1/health")
@app.get("/api/v1/ai/status")
def get_ai_status():
    """
    Returns the real-time configuration status of the Featherless AI proxy,
    active model, and fallback readiness.
    """
    return featherless_client.get_status()


@app.post("/api/v1/ai/analyze-statement")
def analyze_witness_statement(req: StatementAnalysisRequest):
    """
    Analyzes an uploaded witness statement with prompt-injection defenses.
    Extracts structured candidate events, directions, movements, explicit speeds,
    and ambiguous terminology without hallucinating numbers.
    """
    try:
        result = featherless_client.analyze_witness_statement(
            statement=req.statement,
            witness_id=req.witnessId or "WIT-UNKNOWN",
            witness_name=req.witnessName or "Witness",
            witness_role=req.witnessRole or "Observer",
            incident_id=req.incidentId or "INC-2026-0884"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Statement analysis error: {str(e)}")


@app.post("/api/v1/ai/correlate-event")
def correlate_event(req: EventCorrelationRequest):
    """
    Cross-references an extracted candidate event against deterministic timeline events.
    Classifies correlation as SUPPORTED, PARTIALLY_SUPPORTED, CONTRADICTED, UNVERIFIABLE, or INSUFFICIENT_DATA.
    """
    try:
        result = featherless_client.correlate_event(
            candidate_event=req.candidateEvent,
            timeline_events=req.timelineEvents or [],
            telemetry_summary=req.telemetrySummary
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Event correlation error: {str(e)}")


@app.post("/api/v1/ai/explain-contradiction")
def explain_contradiction(req: ContradictionRequest):
    """
    Explains a detected contradiction using Featherless AI with strict
    forensic guardrails and evidence-grounded fallback.
    """
    try:
        result = featherless_client.explain_contradiction(req.contradiction)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contradiction explanation error: {str(e)}")


@app.post("/api/v1/ai/investigator-chat")
def investigator_chat(req: InvestigatorChatRequest):
    """
    Interactive AI investigator assistant answering incident queries strictly grounded
    in available evidence. Discloses missing evidence and uncertainties.
    """
    try:
        result = featherless_client.investigator_chat(
            query=req.query,
            incident_context=req.incidentContext or {},
            chat_history=req.chatHistory or []
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Investigator chat error: {str(e)}")


@app.post("/api/v1/ai/generate-summary")
def generate_investigation_summary(req: InvestigationSummaryRequest):
    """
    Generates a narrative forensic report summary for review and acceptance by human investigators.
    """
    try:
        result = featherless_client.generate_investigation_summary(
            incident_context=req.incidentContext
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summary generation error: {str(e)}")


@app.post("/api/v1/ai/summarize-evidence")
def summarize_evidence(req: EvidenceSummaryRequest):
    """
    Summarizes supporting evidentiary streams without inventing facts.
    """
    try:
        result = featherless_client.summarize_evidence(req.evidenceItems)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evidence summarization error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
