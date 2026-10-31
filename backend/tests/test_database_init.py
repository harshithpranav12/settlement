import sqlite3
import pytest
from app.database import get_db_connection, init_db


def test_database_table_initialization():
    """Verify that all 7 required domain tables and performance indices are initialized."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row["name"] for row in cursor.fetchall()}

        expected_tables = {
            "incidents",
            "parties",
            "evidence",
            "extracted_events",
            "contradictions",
            "evidence_requests",
            "analysis_runs",
        }
        for table in expected_tables:
            assert table in tables, f"Expected table {table} not found in database."

        # Verify performance indices
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
        indices = {row["name"] for row in cursor.fetchall()}
        assert "idx_parties_incident" in indices
        assert "idx_evidence_incident" in indices
        assert "idx_events_incident" in indices


def test_foreign_key_enforcement():
    """Verify that foreign key constraints are enforced on inserts."""
    with get_db_connection() as conn:
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                """
                INSERT INTO parties (id, incident_id, party_label, name, vehicle_registration, statement, created_at)
                VALUES ('party-1', 'non-existent-incident-id', 'V1', 'John Doe', 'KA-01-AB-1234', 'Statement', '2026-10-31T00:00:00Z')
                """
            )
