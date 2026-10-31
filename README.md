# TRACE-AI

**Evidence-based timeline reconstruction and factual contradiction identification for road accident forensic analysis.**

TRACE AI synthesizes multi-modal evidentiary data—including driver/witness statements, vehicle telematics/sensor CSV files, and computer-vision vehicle tracking observations—into an objective, chronologically ordered reconstruction of a motor vehicle collision.

---

## Key System Features

1. **Forensic Witness Statement Analysis (`statement_analyzer.py`)**
   - Extracts structured claims from driver statements (Party V1 and Party V2) with verbatim source excerpts.
   - Cross-examines accounts to identify conflicting claims, compatible statements, and unresolved questions.
   - Generates actionable evidence requests (e.g. CCTV video, traffic signal timing logs) to resolve specific discrepancies.
   - Uses Featherless AI (`meta-llama/Meta-Llama-3.1-8B-Instruct`) with robust offline mock mode fallback.
   - Strictly enforces neutral forensic rules: never labels statements as "true" merely because an LLM says so; never invents timestamps or vehicle movements.

2. **Secure Evidence Ingestion & Management (`evidence_service.py`)**
   - Supports multipart file uploads for videos (`.mp4`, `.avi`, `.mov`) and telematics (`.csv`, `.tsv`, `.gpx`).
   - Supports structured JSON ingestion for supplementary witness statements.
   - Enforces a 100 MB maximum bounded chunked streaming upload (prevents memory spikes).
   - Generates safe server-side filenames and prevents path traversal attacks (`..` resolution checks).
   - Verifies SHA-256 data integrity and tracks lifecycle statuses (`uploaded`, `queued`, `processing`, `completed`, `failed`).

3. **Deterministic Telematics Sensor Analysis (`sensor_analysis.py`)**
   - Parses tabular telemetry with Pandas, validating numeric bounds and required columns (`timestamp`, `speed`).
   - Detects observable physical phenomena: rapid decelerations, vehicle standstill/stops, and missing telemetry data gaps.
   - Preserves source row numbers and timestamps for complete audit traceability.
   - Strictly avoids inferring collisions from speed drops alone and never fabricates missing measurements.

4. **Computer Vision Ingestion Service (`video_analysis.py`)**
   - Ingests structured bounding box detections, trajectory sequences, and physics reasoning from vision pipelines.
   - Validates coordinates against frame dimensions, rejects inverted boxes and negative timestamps.
   - Clearly separates 2D image pixel coordinates from geographic coordinates.
   - Labels tracks as algorithm-generated IDs (e.g., `TRACK_1`), never asserting real-world vehicle identity.

5. **Multi-Modal Timeline Engine (`timeline_engine.py`)**
   - Synthesizes normalized events across witness claims, sensor rows, and vision detections.
   - Separates video-relative elapsed offsets from real-world UTC clock time unless explicit synchronization offsets are provided.
   - Clusters events into physical occurrences only when adequate supporting evidence exists within compatible time windows.

6. **Contradiction Detection Engine (`contradiction_engine.py`)**
   - Identifies factual incompatibilities between claims and physical telemetry/vision observations.
   - Distinguishes direct contradictions from missing evidence and wording differences.
   - Never assumes absence from video proves non-occurrence; preserves unresolved contradictions objectively.

7. **Automated Investigation Workflow Coordinator (`investigation_engine.py`)**
   - Evaluates incident progress: `awaiting_initial_statements`, `awaiting_evidence`, `processing`, `ready_for_review`, or `failed`.
   - Generates targeted evidence requests to resolve open contradictions without endless loops.
   - Retains run history in SQLite without overwriting previous runs.

8. **Forensic Investigation Report Generator (`report_generator.py`)**
   - Produces a comprehensive 10-section report conforming to forensic legal standards:
     1. Incident summary
     2. Parties and verbatim statements
     3. Chronological timeline
     4. Video observations with source frame numbers and bounding boxes
     5. Sensor observations with CSV row numbers and speed/brake states
     6. Conflicting claims
     7. Evidence supporting each finding
     8. Unresolved questions and missing evidence
     9. Evidentiary limitations (blind spots, pixel coordinates, absence caveats)
     10. Concise, evidence-grounded summary
   - Explicitly disclaims legal liability and civil fault attribution.

---

## Project Structure

```
TRACE-AI/
├── backend/
│   ├── app/
│   │   ├── config.py              # Pydantic BaseSettings & environment configuration
│   │   ├── main.py                # FastAPI app factory, CORS, exception handlers, router registration
│   │   ├── database/
│   │   │   ├── connection.py      # SQLite connection manager with PRAGMA foreign_keys=ON
│   │   │   ├── repository.py      # Parameterized SQLite data access layer
│   │   │   └── schema.py          # Relational schema (8 tables with cascade & indices)
│   │   ├── models/                # Pydantic v2 schemas and Enums
│   │   │   ├── enums.py           # PartyLabel, IncidentStatus, EvidenceType, etc.
│   │   │   ├── incident.py        # IncidentCreate, IncidentResponse, IncidentDetailResponse
│   │   │   ├── party.py           # PartyCreate, PartyResponse
│   │   │   ├── evidence.py        # EvidenceCreate, EvidenceResponse, WitnessStatementCreate
│   │   │   ├── event.py           # ExtractedEventCreate, ExtractedEventResponse
│   │   │   ├── contradiction.py   # ContradictionCreate, ContradictionResponse
│   │   │   ├── evidence_request.py# EvidenceRequestCreate, EvidenceRequestResponse
│   │   │   ├── analysis_run.py    # AnalysisRunCreate, AnalysisRunResponse
│   │   │   ├── statement_analysis.py # Featherless LLM schemas & claim extraction
│   │   │   ├── sensor_analysis.py # Sensor telemetry parsing & anomaly schemas
│   │   │   ├── video_analysis.py  # CV detection & trajectory ingestion schemas
│   │   │   ├── timeline.py        # Timeline items, sync requests, and occurrences
│   │   │   ├── contradiction_engine.py # Contradiction finding & missing evidence schemas
│   │   │   ├── investigation.py   # Investigation workflow response schemas
│   │   │   └── report.py          # 10-section forensic investigation report schemas
│   │   ├── routes/                # FastAPI APIRouters
│   │   │   ├── health.py          # GET /api/health
│   │   │   ├── incident.py        # /api/incidents and /api/incidents/{id}/parties CRUD
│   │   │   ├── evidence.py        # /api/incidents/{id}/evidence and evidence requests
│   │   │   └── analysis.py        # Timeline, contradiction, CV, sensor, investigation, report
│   │   └── services/              # Core business logic and forensic engines
│   │       ├── evidence_service.py
│   │       ├── sensor_analysis.py
│   │       ├── video_analysis.py
│   │       ├── statement_analyzer.py
│   │       ├── timeline_engine.py
│   │       ├── contradiction_engine.py
│   │       ├── investigation_engine.py
│   │       └── report_generator.py
│   ├── data/
│   │   └── uploads/               # Isolated disk directory for evidence storage
│   ├── tests/                     # Automated test suites (74 unit & integration tests)
│   ├── .env.example               # Environment variables template
│   ├── pytest.ini                 # Pytest configuration
│   └── requirements.txt           # Python dependencies
└── README.md
```

---

## Setup & Environment Configuration

### Prerequisites
- Python 3.11+ (Python 3.14 compatible)
- `pip` or virtualenv package manager

### 1. Create Virtual Environment
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment settings in `.env`:
```ini
# Server Configuration
HOST=127.0.0.1
PORT=8000
DEBUG=True
ENVIRONMENT=development

# Application Info
PROJECT_NAME="TRACE AI Backend"
API_PREFIX=/api

# CORS Configuration (comma-separated allowed origins)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Database & Storage
DATABASE_URL=sqlite:///./trace_ai.db
UPLOAD_DIR=data/uploads
MAX_UPLOAD_SIZE_MB=100

# Featherless AI Service
# Keep FEATHERLESS_API_KEY exclusively on the backend; never commit to Git
FEATHERLESS_API_KEY=your_featherless_api_key_here
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
FEATHERLESS_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
FEATHERLESS_TIMEOUT_SECONDS=60.0

# Set FEATHERLESS_MOCK_MODE=True to run offline deterministic testing without an API key
FEATHERLESS_MOCK_MODE=True
```

---

## Starting the Application

Activate the virtual environment and launch Uvicorn:
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Once running:
- **API Base:** `http://127.0.0.1:8000`
- **Swagger UI (Interactive API Docs):** `http://127.0.0.1:8000/docs`
- **ReDoc Documentation:** `http://127.0.0.1:8000/redoc`
- **OpenAPI JSON:** `http://127.0.0.1:8000/openapi.json`
- **Health Check:** `http://127.0.0.1:8000/api/health`

---

## REST API Endpoints Reference

All endpoints (except root and docs) are prefixed with `/api`.

| Method | Path | Summary / Description |
|---|---|---|
| `GET` | `/api/health` | Health check endpoint returning service status, environment, and version. |
| `POST` | `/api/incidents` | Create a new accident incident case. |
| `GET` | `/api/incidents` | List all incidents ordered by creation date descending. |
| `GET` | `/api/incidents/{incident_id}` | Retrieve incident detail with registered parties, evidence counts, and run history. |
| `PATCH` | `/api/incidents/{incident_id}` | Update incident title, location, or status. |
| `DELETE` | `/api/incidents/{incident_id}` | Delete incident and all cascade-related database records. |
| `POST` | `/api/incidents/{incident_id}/parties` | Register Party V1 or V2 with vehicle registration and statement. |
| `GET` | `/api/incidents/{incident_id}/parties` | List parties registered for an incident. |
| `POST` | `/api/incidents/{incident_id}/evidence` | Upload evidence file (`multipart/form-data`) or JSON witness statement (`application/json`). |
| `GET` | `/api/incidents/{incident_id}/evidence` | List all evidence items registered for an incident. |
| `GET` | `/api/incidents/{incident_id}/evidence-requests` | List all evidence requests generated for an incident. |
| `POST` | `/api/incidents/{incident_id}/evidence-requests/{request_id}/dismiss` | Dismiss an outstanding evidence request. |
| `POST` | `/api/incidents/{incident_id}/analyze-statements` | Trigger Featherless LLM comparative analysis between V1 and V2 statements. |
| `POST` | `/api/incidents/{incident_id}/evidence/{evidence_id}/analyze-sensor` | Deterministically parse and extract observations from uploaded sensor CSV telemetry. |
| `POST` | `/api/incidents/{incident_id}/cv-detections` | Ingest computer-vision detection bounding boxes, tracks, and trajectories. |
| `POST` | `/api/incidents/{incident_id}/evidence/{evidence_id}/cv-detections` | Ingest CV detections tied to a specific video evidence ID. |
| `GET` | `/api/incidents/{incident_id}/timeline` | Retrieve chronological multi-modal timeline with clustered occurrences. |
| `POST` | `/api/incidents/{incident_id}/timeline` | Retrieve timeline with explicit video wall-clock synchronization offsets. |
| `GET` | `/api/incidents/{incident_id}/contradictions` | Evaluate contradictions between claims, vision detections, and telematics. |
| `POST` | `/api/incidents/{incident_id}/detect-contradictions` | Trigger contradiction analysis and persist findings. |
| `GET` | `/api/incidents/{incident_id}/investigate` | Get automated investigation workflow status (`awaiting_initial_statements`, `awaiting_evidence`, `ready_for_review`). |
| `POST` | `/api/incidents/{incident_id}/investigate` | Execute the end-to-end multi-modal investigation workflow and generate requests. |
| `GET` | `/api/incidents/{incident_id}/report` | Retrieve cached or generate full 10-section structured forensic investigation report. |
| `POST` | `/api/incidents/{incident_id}/report` | Force-generate a new 10-section forensic investigation report. |

---

## Running Automated Tests

TRACE AI maintains an automated test suite with **74 passing tests** covering all modules, models, database foreign keys, and API routes.

To run the complete test suite:
```bash
cd backend
source .venv/bin/activate
pytest -v
```

### Test Suite Breakdown:
- `test_health.py`: Health endpoint, root route, 404 handler, CORS allowed origins.
- `test_database.py`: SQLite connection and query execution.
- `test_database_init.py`: Table creation and SQLite `PRAGMA foreign_keys = ON` cascade enforcement.
- `test_incident.py`: Incident CRUD and analysis run tracking at repository level.
- `test_party.py`: Party constraints (V1/V2 validation, uniqueness per incident).
- `test_incident_routes.py`: REST endpoints for Incidents and Parties (`/api/incidents`).
- `test_evidence.py`: Evidence record creation and foreign key links.
- `test_evidence_management.py`: Multipart uploads, JSON statements, 100 MB file size limit (413), file type filtering (415), path traversal guards, request fulfillment, request dismissal.
- `test_statement_analyzer.py`: Featherless mock mode, API call handling, 503 missing API key, 400 missing parties, 504 provider timeout, 429 rate limit, 502 invalid JSON.
- `test_sensor_analysis.py`: Telematics CSV validation, UTC/relative timestamp parsing, rapid deceleration detection, vehicle stops, missing data gap detection, malformed row handling.
- `test_video_analysis.py`: CV detection ingestion, geometry validation, inverted box rejection, negative timestamp rejection, confidence validation, trajectory coordinate sequence generation.
- `test_timeline_engine.py`: Multi-modal chronological sorting, separation of video offsets from wall-clock UTC, explicit clock synchronization, occurrence clustering.
- `test_contradiction_engine.py`: Traffic signal conflicts, wording differences, missing timestamps, incomparability of clock times, inconclusive video evidence.
- `test_investigation_and_report.py`: Automated investigation workflow state transitions, 10-section report generation, report persistence, and cached retrieval.

---

## Forensic Integrity Guarantees

1. **No Evidence Fabrication:** The system never extrapolates, synthesizes, or invents vehicle speeds, timestamps, or maneuvers. All claims require verbatim excerpts (`original_quote`).
2. **Epistemic Classification:** All data items are strictly typed as `OBSERVATION` (direct sensor or video record), `CLAIM` (subjective witness statement), or `INFERENCE` (algorithmic correlation).
3. **No Uncalibrated Probability:** Raw detection and extraction confidence scores are presented as algorithmic heuristics and explicitly not labeled as calibrated Bayesian probabilities.
4. **No Legal Fault Determination:** TRACE AI performs objective timeline and factual conflict analysis. It explicitly includes legal disclaimers that it does not assess liability, criminal culpability, or financial fault.
