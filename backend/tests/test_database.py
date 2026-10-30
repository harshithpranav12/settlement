import os
from unittest.mock import patch
from app.database import get_db_connection, init_db


def test_database_connection(tmp_path):
    """Verify SQLite connection can execute queries successfully."""
    test_db = tmp_path / "test.db"
    with patch("app.config.settings.DATABASE_URL", f"sqlite:///{test_db}"):
        init_db()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 AS num")
            row = cursor.fetchone()
            assert row["num"] == 1

