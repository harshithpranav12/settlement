"""SQLite database schema definitions with foreign keys and indices for TRACE AI."""

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

-- 1. Incidents Table
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'created',
    created_at TEXT NOT NULL
);

-- 2. Parties Table (Restricted to V1 or V2 per incident)
CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    party_label TEXT NOT NULL CHECK(party_label IN ('V1', 'V2')),
    name TEXT NOT NULL,
    vehicle_registration TEXT NOT NULL,
    statement TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE,
    UNIQUE (incident_id, party_label)
);

-- 3. Evidence Table (File references stored outside database)
CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    party_id TEXT,
    evidence_request_id TEXT,
    evidence_type TEXT NOT NULL,
    original_filename TEXT,
    storage_reference TEXT NOT NULL,
    upload_time TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'uploaded',
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE,
    FOREIGN KEY (party_id) REFERENCES parties (id) ON DELETE SET NULL,
    FOREIGN KEY (evidence_request_id) REFERENCES evidence_requests (id) ON DELETE SET NULL
);

-- 4. Extracted Events and Claims Table
-- Separates wall-clock (UTC) and video-relative offsets; allows unknown timestamps
CREATE TABLE IF NOT EXISTS extracted_events (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    source_id TEXT,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    classification TEXT NOT NULL CHECK(classification IN ('observation', 'claim', 'inference')),
    wall_clock_timestamp TEXT,
    wall_clock_end_timestamp TEXT,
    video_offset_seconds REAL,
    video_end_offset_seconds REAL,
    evidence_references TEXT NOT NULL DEFAULT '[]',
    confidence REAL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
);

-- 5. Contradictions Table
CREATE TABLE IF NOT EXISTS contradictions (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    event_id_a TEXT,
    event_id_b TEXT,
    severity TEXT NOT NULL DEFAULT 'moderate',
    status TEXT NOT NULL DEFAULT 'detected',
    created_at TEXT NOT NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE,
    FOREIGN KEY (event_id_a) REFERENCES extracted_events (id) ON DELETE SET NULL,
    FOREIGN KEY (event_id_b) REFERENCES extracted_events (id) ON DELETE SET NULL
);

-- 6. Evidence Requests Table
CREATE TABLE IF NOT EXISTS evidence_requests (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    request_type TEXT NOT NULL,
    description TEXT NOT NULL,
    target_party TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    fulfilled_evidence_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE,
    FOREIGN KEY (fulfilled_evidence_id) REFERENCES evidence (id) ON DELETE SET NULL
);

-- 7. Analysis Runs Table (Maintains analysis history for an incident)
CREATE TABLE IF NOT EXISTS analysis_runs (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    run_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    summary TEXT,
    findings TEXT NOT NULL DEFAULT '{}',
    error_message TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
);

-- Performance indices for incident foreign keys
CREATE INDEX IF NOT EXISTS idx_parties_incident ON parties(incident_id);
CREATE INDEX IF NOT EXISTS idx_evidence_incident ON evidence(incident_id);
CREATE INDEX IF NOT EXISTS idx_events_incident ON extracted_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_incident ON contradictions(incident_id);
CREATE INDEX IF NOT EXISTS idx_evidence_requests_incident ON evidence_requests(incident_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_incident ON analysis_runs(incident_id);
"""
