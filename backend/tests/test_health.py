from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    """Verify GET /api/health returns 200 OK with expected JSON payload."""
    response = client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "TRACE AI Backend"
    assert "version" in data
    assert "environment" in data


def test_cors_headers_allowed_origin():
    """Verify that requests from http://localhost:5173 include CORS headers."""
    response = client.get(
        "/api/health",
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_root_endpoint():
    """Verify root GET / returns active message and endpoint links."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "TRACE AI Backend" in data["message"]
    assert data["health"] == "/api/health"


def test_not_found_error_handler():
    """Verify non-existent route returns 404 with structured JSON response."""
    response = client.get("/api/non-existent-endpoint")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
