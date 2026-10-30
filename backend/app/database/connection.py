import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from app.config import settings
from app.database.schema import SCHEMA_SQL


def get_db_path() -> str:
    """Extract SQLite file path from DATABASE_URL."""
    url = settings.DATABASE_URL
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "")
    return url


def get_connection() -> sqlite3.Connection:
    """Create a new SQLite connection with foreign keys and row factory configured."""
    db_path = get_db_path()

    # Ensure parent directory exists if using a file path
    if db_path != ":memory:" and not db_path.startswith(":memory:"):
        parent_dir = Path(db_path).parent
        parent_dir.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    # Foreign keys must be explicitly enabled per connection in SQLite
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for SQLite connections ensuring proper commit/close."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initialize database tables automatically from schema and ensure storage directory exists."""
    # Ensure storage directory for external evidence files exists
    upload_path = Path(settings.UPLOAD_DIR)
    upload_path.mkdir(parents=True, exist_ok=True)

    with get_db_connection() as conn:
        conn.executescript(SCHEMA_SQL)

        # Ensure evidence_request_id column exists for existing tables
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(evidence)")
        columns = [row["name"] for row in cursor.fetchall()]
        if columns and "evidence_request_id" not in columns:
            conn.execute("ALTER TABLE evidence ADD COLUMN evidence_request_id TEXT;")
