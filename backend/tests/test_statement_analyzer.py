"""Unit tests for witness statement analyzer service and endpoint."""

import json
from unittest.mock import AsyncMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import (
    create_incident,
    create_party,
    get_incident_detail,
    list_analysis_runs_for_incident,
    list_contradictions_for_incident,
    list_evidence_requests_for_incident,
    list_events_for_incident,
)
from app.main import app
from app.models import IncidentCreate, PartyCreate, PartyLabel

client = TestClient(app)


def _setup_incident_with_statements(
    title: str = "T-Bone Crash at Intersection",
    v1_stmt: str = "The traffic light was solid green when I entered the intersection. V2 suddenly appeared from the left speeding.",
    v2_stmt: str = "I had the green arrow and was turning. V1 blew through a red light at 50 mph without braking.",
):
    """Helper to register an incident with V1 and V2 statements."""
    incident = create_incident(IncidentCreate(title=title, location="Oak & 4th Street"))
    p1 = create_party(
        incident.id,
        PartyCreate(
            party_label=PartyLabel.V1,
            name="Alice Walker",
            vehicle_registration="NY-111",
            statement=v1_stmt,
        ),
    )
    p2 = create_party(
        incident.id,
        PartyCreate(
            party_label=PartyLabel.V2,
            name="Bob Davis",
            vehicle_registration="NY-222",
            statement=v2_stmt,
        ),
    )
    return incident, p1, p2


# ============================================================================
# 1. MOCK MODE TESTS (No external network, tests local logic & DB persistence)
# ============================================================================

def test_statement_analysis_mock_mode():
    """Verify analysis in mock mode extracts claims, conflicts, saves to DB, and returns structured JSON."""
    incident, p1, p2 = _setup_incident_with_statements()

    with patch.object(settings, "FEATHERLESS_MOCK_MODE", True):
        response = client.post(f"/api/incidents/{incident.id}/analyze-statements")

    assert response.status_code == 200
    data = response.json()

    assert data["incident_id"] == incident.id
    assert data["analysis_id"] is not None
    assert data["is_mock"] is True
    assert "conclusion_status" in data

    # Verify structured fields
    assert len(data["claims"]) == 2
    for claim in data["claims"]:
        assert "original_quote" in claim
        assert len(claim["original_quote"]) > 0
        assert claim["party_label"] in ["V1", "V2"]

    assert len(data["conflicts"]) >= 1
    conflict = data["conflicts"][0]
    assert conflict["topic"] == "Right-of-Way and Signal Discrepancy"
    assert "v1_quote" in conflict
    assert "v2_quote" in conflict
    assert conflict["resolvable_by_evidence"] is True

    assert len(data["compatible_claims"]) >= 1
    assert len(data["unresolved_questions"]) >= 1
    assert len(data["evidence_requests"]) >= 1

    # Verify database persistence
    events = list_events_for_incident(incident.id)
    assert len(events) >= 2
    assert all(e.classification.value == "claim" for e in events)

    contradictions = list_contradictions_for_incident(incident.id)
    assert len(contradictions) >= 1

    ev_requests = list_evidence_requests_for_incident(incident.id)
    assert len(ev_requests) >= 1

    runs = list_analysis_runs_for_incident(incident.id)
    assert len(runs) >= 1
    assert runs[0].run_type == "statement_analysis"


# ============================================================================
# 2. MOCKED HTTP FEATHERLESS API CALL
# ============================================================================

def test_statement_analysis_mocked_featherless_api():
    """Verify handling and schema validation with mocked Featherless chat completions response."""
    incident, p1, p2 = _setup_incident_with_statements()

    mock_llm_json = {
        "claims": [
            {
                "claim_id": "c1",
                "party_label": "V1",
                "party_name": "Alice Walker",
                "category": "traffic_signal",
                "claim_text": "V1 claims the signal was green upon entering intersection.",
                "original_quote": "The traffic light was solid green when I entered the intersection.",
                "temporal_context": "Entering intersection",
            },
            {
                "claim_id": "c2",
                "party_label": "V2",
                "party_name": "Bob Davis",
                "category": "traffic_signal",
                "claim_text": "V2 claims V1 ran a red light.",
                "original_quote": "V1 blew through a red light at 50 mph without braking.",
                "temporal_context": "Entering intersection",
            },
        ],
        "conflicts": [
            {
                "conflict_id": "conf_1",
                "topic": "Traffic Signal Phase",
                "v1_claim_id": "c1",
                "v2_claim_id": "c2",
                "v1_quote": "The traffic light was solid green",
                "v2_quote": "V1 blew through a red light",
                "conflict_nature": "Opposing claims on which driver had the green signal.",
                "severity": "critical",
                "resolvable_by_evidence": True,
                "recommended_evidence_type": "cctv_footage",
            }
        ],
        "compatible_claims": [
            {
                "topic": "Intersection Location",
                "summary": "Both parties agree the collision occurred in the intersection.",
                "v1_quote": "entered the intersection",
                "v2_quote": "was turning",
            }
        ],
        "unresolved_questions": [
            {
                "question_id": "uq_1",
                "topic": "Vehicle Velocity",
                "question": "What was the actual speed of V1 at point of impact?",
                "party_affected": "V1",
                "reason": "V2 claims 50 mph, V1 provides no speed estimate.",
            }
        ],
        "evidence_requests": [
            {
                "request_type": "traffic_signal_timing_log",
                "description": "Request traffic controller timing records for Oak & 4th St at timestamp of incident.",
                "target_party": "City Traffic Dept",
                "rationale": "Objectively determine signal phases for north-south vs turning traffic.",
            }
        ],
        "conclusion_status": "conflicts_identified_pending_evidence",
    }

    mock_response = httpx.Response(
        status_code=200,
        json={
            "id": "chatcmpl-mock-123",
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(mock_llm_json),
                    }
                }
            ],
        },
        request=httpx.Request("POST", "https://api.featherless.ai/v1/chat/completions"),
    )

    with patch.object(settings, "FEATHERLESS_MOCK_MODE", False), \
         patch.object(settings, "FEATHERLESS_API_KEY", "mock-test-key-xyz"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        response = client.post(f"/api/incidents/{incident.id}/analyze-statements")

    assert response.status_code == 200
    data = response.json()
    assert data["is_mock"] is False
    assert len(data["claims"]) == 2
    assert len(data["conflicts"]) == 1
    assert data["conflicts"][0]["topic"] == "Traffic Signal Phase"
    assert data["evidence_requests"][0]["request_type"] == "traffic_signal_timing_log"

    # Confirm incident detail shows updated analysis run count
    detail = get_incident_detail(incident.id)
    assert len(detail.analysis_history) == 1
    assert detail.analysis_history[0].run_type == "statement_analysis"


# ============================================================================
# 3. ERROR HANDLING & VALIDATION
# ============================================================================

def test_missing_api_key_when_mock_disabled():
    """Verify 503 is returned with clear instructions when API key is missing and mock is False."""
    incident, p1, p2 = _setup_incident_with_statements()

    with patch.object(settings, "FEATHERLESS_MOCK_MODE", False), \
         patch.object(settings, "FEATHERLESS_API_KEY", None):
        response = client.post(f"/api/incidents/{incident.id}/analyze-statements")

    assert response.status_code == 503
    assert "FEATHERLESS_API_KEY" in response.json()["error"]


def test_missing_parties_returns_400():
    """Verify 400 is returned when an incident lacks V1 or V2."""
    incident = create_incident(IncidentCreate(title="Crash with missing party"))
    create_party(
        incident.id,
        PartyCreate(party_label=PartyLabel.V1, name="Solo Driver", vehicle_registration="ABC"),
    )

    with patch.object(settings, "FEATHERLESS_MOCK_MODE", True):
        response = client.post(f"/api/incidents/{incident.id}/analyze-statements")

    assert response.status_code == 400
    assert "both party V1 and party V2" in response.json()["error"]


def test_empty_statement_returns_400():
    """Verify 400 is returned if a party has an empty or whitespace statement."""
    incident = create_incident(IncidentCreate(title="Crash with blank statement"))
    create_party(
        incident.id,
        PartyCreate(party_label=PartyLabel.V1, name="Alice", vehicle_registration="ABC", statement=""),
    )
    create_party(
        incident.id,
        PartyCreate(party_label=PartyLabel.V2, name="Bob", vehicle_registration="XYZ", statement="Valid statement"),
    )

    with patch.object(settings, "FEATHERLESS_MOCK_MODE", True):
        response = client.post(f"/api/incidents/{incident.id}/analyze-statements")

    assert response.status_code == 400
    assert "no recorded statement" in response.json()["error"]


def test_provider_timeout_returns_504():
    """Verify 504 Gateway Timeout when Featherless API times out."""
    incident, p1, p2 = _setup_incident_with_statements()

    with patch.object(settings, "FEATHERLESS_MOCK_MODE", False), \
         patch.object(settings, "FEATHERLESS_API_KEY", "mock-key"), \
         patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Read timeout")):
        response = client.post(f"/api/incidents/{incident.id}/analyze-statements")

    assert response.status_code == 504
    assert "timed out" in response.json()["error"]


def test_provider_rate_limit_returns_429():
    """Verify 429 Too Many Requests when Featherless provider rate limits."""
    incident, p1, p2 = _setup_incident_with_statements()

    mock_rate_limit = httpx.Response(
        status_code=429,
        text="Rate limit exceeded",
        request=httpx.Request("POST", "https://api.featherless.ai/v1/chat/completions"),
    )

    with patch.object(settings, "FEATHERLESS_MOCK_MODE", False), \
         patch.object(settings, "FEATHERLESS_API_KEY", "mock-key"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_rate_limit):
        response = client.post(f"/api/incidents/{incident.id}/analyze-statements")

    assert response.status_code == 429
    assert "rate limit" in response.json()["error"].lower()


def test_invalid_llm_json_returns_502():
    """Verify 502 Bad Gateway when LLM returns non-JSON or invalid syntax."""
    incident, p1, p2 = _setup_incident_with_statements()

    mock_invalid_resp = httpx.Response(
        status_code=200,
        json={
            "choices": [{"message": {"content": "This is non-JSON gibberish from the model."}}]
        },
        request=httpx.Request("POST", "https://api.featherless.ai/v1/chat/completions"),
    )

    with patch.object(settings, "FEATHERLESS_MOCK_MODE", False), \
         patch.object(settings, "FEATHERLESS_API_KEY", "mock-key"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_invalid_resp):
        response = client.post(f"/api/incidents/{incident.id}/analyze-statements")

    assert response.status_code == 502
    assert "invalid or non-JSON" in response.json()["error"]
