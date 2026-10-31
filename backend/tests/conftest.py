"""Pytest configuration and fixtures for TRACE AI test suite."""

import os
from unittest.mock import patch
import pytest

from app.config import settings
from app.database import init_db


@pytest.fixture(autouse=True)
def isolated_db(tmp_path):
    """Provide an isolated SQLite database for each test to avoid test contamination."""
    db_file = tmp_path / "test_trace_ai.db"
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    with patch.object(settings, "DATABASE_URL", f"sqlite:///{db_file}"), \
         patch.object(settings, "UPLOAD_DIR", str(upload_dir)):
        init_db()
        yield db_file
