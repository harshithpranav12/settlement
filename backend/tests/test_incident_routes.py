"""Tests for Incident and Party REST API endpoints."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_create_and_list_incidents():
    """Verify POST /api/incidents and GET /api/incidents."""
    res = client.post(
        "/api/incidents",
        json={"title": "Highway Collision 101", "location": "Route 9, Mile 42"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Highway Collision 101"
    incident_id = data["id"]

    # List
    list_res = client.get("/api/incidents")
    assert list_res.status_code == 200
    ids = [i["id"] for i in list_res.json()]
    assert incident_id in ids


def test_incident_detail_and_update():
    """Verify GET and PATCH /api/incidents/{id}."""
    create_res = client.post(
        "/api/incidents",
        json={"title": "Downtown Minor Bump", "location": "Maple & 4th"},
    )
    incident_id = create_res.json()["id"]

    # Detail
    detail_res = client.get(f"/api/incidents/{incident_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["title"] == "Downtown Minor Bump"
    assert "parties" in detail
    assert "evidence_count" in detail
    assert "analysis_history" in detail

    # Update
    patch_res = client.patch(
        f"/api/incidents/{incident_id}",
        json={"status": "analyzing", "location": "Maple & 4th (Intersection)"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "analyzing"
    assert patch_res.json()["location"] == "Maple & 4th (Intersection)"


def test_party_endpoints():
    """Verify POST and GET /api/incidents/{id}/parties."""
    create_res = client.post(
        "/api/incidents",
        json={"title": "Two-Car T-Bone", "location": "Broadway"},
    )
    incident_id = create_res.json()["id"]

    # Add V1
    p1_res = client.post(
        f"/api/incidents/{incident_id}/parties",
        json={
            "party_label": "V1",
            "name": "Sarah Connor",
            "vehicle_registration": "CYBER-01",
            "statement": "I had the green light.",
        },
    )
    assert p1_res.status_code == 201
    assert p1_res.json()["party_label"] == "V1"

    # Add V2
    p2_res = client.post(
        f"/api/incidents/{incident_id}/parties",
        json={
            "party_label": "V2",
            "name": "John Doe",
            "vehicle_registration": "HUMAN-02",
            "statement": "The signal was green for me.",
        },
    )
    assert p2_res.status_code == 201

    # List parties
    list_p = client.get(f"/api/incidents/{incident_id}/parties")
    assert list_p.status_code == 200
    labels = [p["party_label"] for p in list_p.json()]
    assert "V1" in labels
    assert "V2" in labels


def test_delete_incident():
    """Verify DELETE /api/incidents/{id}."""
    create_res = client.post(
        "/api/incidents",
        json={"title": "To Be Deleted", "location": "Nowhere"},
    )
    incident_id = create_res.json()["id"]

    del_res = client.delete(f"/api/incidents/{incident_id}")
    assert del_res.status_code == 204

    # Confirm 404 after deletion
    get_res = client.get(f"/api/incidents/{incident_id}")
    assert get_res.status_code == 404
