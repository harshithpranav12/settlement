"""Deterministic sensor and telematics analysis service for TRACE AI.

Parses vehicle sensor CSV files with Pandas, validates columns and numeric data,
detects observable kinematic patterns (speed decreases, stops, gaps),
preserves raw row numbers and source filenames, and stores extracted
observations into SQLite without fabricating data or inferring collisions.
"""

from datetime import datetime, timezone
import io
import json
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

from fastapi import HTTPException, status
import numpy as np
import pandas as pd
from dateutil import parser as dateutil_parser

from app.database import (
    create_analysis_run,
    create_event,
    get_evidence,
    get_incident,
    update_evidence_status,
)
from app.models.analysis_run import AnalysisRunCreate, AnalysisRunStatus
from app.models.enums import EventClassification, ProcessingStatus
from app.models.event import ExtractedEventCreate
from app.models.sensor_analysis import (
    SensorAnalysisResponse,
    SensorAnomalyOrPattern,
    SensorRowValidationError,
)

logger = logging.getLogger("trace_ai.sensor_analysis")

# Flexible column aliases for robust ingestion
COLUMN_ALIASES: Dict[str, Set[str]] = {
    "timestamp": {
        "timestamp", "time", "datetime", "date_time", "utc_timestamp",
        "utc_time", "elapsed_seconds", "elapsed_time", "t", "time_offset",
    },
    "vehicle_id": {
        "vehicle_id", "vehicle", "party_id", "party_label", "veh_id",
        "car_id", "vin", "registration",
    },
    "speed": {
        "speed", "speed_kmh", "speed_kph", "speed_mps", "speed_mph",
        "velocity", "v_kmh", "speed_km_h",
    },
    "acceleration": {
        "acceleration", "accel", "accel_x", "accel_ms2", "a_x",
        "longitudinal_accel",
    },
    "latitude": {"latitude", "lat", "gps_lat"},
    "longitude": {"longitude", "lon", "lng", "long", "gps_lon"},
    "brake_status": {
        "brake_status", "brake", "braking", "brake_active",
        "brake_pedal", "is_braking",
    },
}


def _resolve_columns(df_columns: List[str]) -> Tuple[Dict[str, str], List[str]]:
    """Match CSV columns against supported domain fields; identify missing required fields."""
    normalized = {re.sub(r"[^a-zA-Z0-9_]", "", col.strip().lower()): col for col in df_columns}
    resolved: Dict[str, str] = {}

    for domain_field, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            clean_alias = re.sub(r"[^a-zA-Z0-9_]", "", alias)
            if clean_alias in normalized:
                resolved[domain_field] = normalized[clean_alias]
                break

    # Required: timestamp, vehicle_id, speed
    missing_required = []
    for req in ["timestamp", "vehicle_id", "speed"]:
        if req not in resolved:
            missing_required.append(req)

    return resolved, missing_required


def _parse_timestamp(
    raw_val: Any
) -> Tuple[Optional[datetime], Optional[float], Optional[str]]:
    """Parse timestamp into UTC datetime if timezone is known, or relative seconds if numeric.

    Returns (utc_datetime, relative_seconds, raw_string).
    Never invents timezones or assumes UTC when format is ambiguous.
    """
    if pd.isna(raw_val) or raw_val is None:
        return None, None, None

    str_val = str(raw_val).strip()
    if not str_val:
        return None, None, None

    # Check if purely numeric elapsed seconds (e.g. 0.0, 1.25, 14.5)
    try:
        float_sec = float(str_val)
        # If float value looks like elapsed seconds (< 10,000,000, not epoch seconds)
        if float_sec < 10_000_000:
            return None, float_sec, str_val
    except ValueError:
        pass

    # Check if string has an explicit timezone specification (e.g. Z or +00:00 or -05:00)
    has_tz = bool(
        re.search(r"Z$|[+-]\d{2}:?\d{2}$", str_val, re.IGNORECASE)
    )

    if has_tz:
        try:
            dt = dateutil_parser.parse(str_val)
            if dt.tzinfo is not None:
                utc_dt = dt.astimezone(timezone.utc)
                return utc_dt, None, str_val
        except (ValueError, TypeError):
            pass

    # Naive date format: do NOT guess timezone
    return None, None, str_val


class SensorAnalysisService:
    """Service executing deterministic analysis on uploaded sensor CSV evidence."""

    def analyze_csv_data(
        self,
        csv_bytes: bytes,
        source_filename: str,
        incident_id: str,
        evidence_id: str,
    ) -> SensorAnalysisResponse:
        """Parse, validate, and extract kinematics observations from sensor CSV."""
        try:
            df = pd.read_csv(io.BytesIO(csv_bytes), skipinitialspace=True)
        except Exception as exc:
            logger.error("Pandas failed to parse CSV '%s': %s", source_filename, str(exc))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Malformed CSV file. Parser error: {str(exc)}",
            ) from exc

        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CSV file '{source_filename}' contains no data rows.",
            )

        col_map, missing = _resolve_columns(list(df.columns))
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Sensor CSV '{source_filename}' is missing required columns: {missing}. "
                    f"Detected columns: {list(df.columns)}. "
                    f"Required: timestamp, vehicle_id, speed."
                ),
            )

        ts_col = col_map["timestamp"]
        veh_col = col_map["vehicle_id"]
        spd_col = col_map["speed"]
        accel_col = col_map.get("acceleration")
        lat_col = col_map.get("latitude")
        lon_col = col_map.get("longitude")
        brake_col = col_map.get("brake_status")

        valid_samples: List[Dict[str, Any]] = []
        validation_errors: List[SensorRowValidationError] = []

        total_rows = len(df)

        # Validate rows and preserve row numbers (1-indexed CSV line = idx + 2)
        for idx, row in df.iterrows():
            row_num = idx + 2  # 1-indexed, accounting for header line
            row_valid = True

            # 1. Vehicle ID check
            raw_veh = row[veh_col]
            if pd.isna(raw_veh) or not str(raw_veh).strip():
                validation_errors.append(
                    SensorRowValidationError(
                        row_number=row_num,
                        column=veh_col,
                        raw_value=raw_veh,
                        error_message="vehicle_id must not be empty.",
                    )
                )
                row_valid = False
                continue
            vehicle_id = str(raw_veh).strip()

            # 2. Speed check
            raw_spd = row[spd_col]
            try:
                speed_val = float(raw_spd)
                if np.isnan(speed_val) or speed_val < 0.0:
                    raise ValueError("Speed must be a non-negative number")
            except (ValueError, TypeError):
                validation_errors.append(
                    SensorRowValidationError(
                        row_number=row_num,
                        column=spd_col,
                        raw_value=raw_spd,
                        error_message="Speed must be a valid non-negative float.",
                    )
                )
                row_valid = False
                continue

            # 3. Timestamp check
            raw_ts = row[ts_col]
            utc_dt, rel_sec, raw_ts_str = _parse_timestamp(raw_ts)
            if utc_dt is None and rel_sec is None and raw_ts_str is None:
                validation_errors.append(
                    SensorRowValidationError(
                        row_number=row_num,
                        column=ts_col,
                        raw_value=raw_ts,
                        error_message="Timestamp is empty or unparseable.",
                    )
                )
                row_valid = False
                continue

            # 4. Optional fields without fabricating missing measurements
            accel_val = None
            if accel_col and not pd.isna(row[accel_col]):
                try:
                    accel_val = float(row[accel_col])
                except (ValueError, TypeError):
                    validation_errors.append(
                        SensorRowValidationError(
                            row_number=row_num,
                            column=accel_col,
                            raw_value=row[accel_col],
                            error_message="Acceleration must be numeric if provided.",
                        )
                    )

            lat_val = None
            if lat_col and not pd.isna(row[lat_col]):
                try:
                    lat_num = float(row[lat_col])
                    if -90.0 <= lat_num <= 90.0:
                        lat_val = lat_num
                except (ValueError, TypeError):
                    pass

            lon_val = None
            if lon_col and not pd.isna(row[lon_col]):
                try:
                    lon_num = float(row[lon_col])
                    if -180.0 <= lon_num <= 180.0:
                        lon_val = lon_num
                except (ValueError, TypeError):
                    pass

            brake_val = None
            if brake_col and not pd.isna(row[brake_col]):
                b_str = str(row[brake_col]).strip().lower()
                brake_val = b_str in {"1", "true", "yes", "active", "on"}

            sample = {
                "row_number": row_num,
                "vehicle_id": vehicle_id,
                "speed_kmh": speed_val,
                "utc_dt": utc_dt,
                "relative_seconds": rel_sec,
                "raw_timestamp": raw_ts_str,
                "acceleration": accel_val,
                "latitude": lat_val,
                "longitude": lon_val,
                "brake_status": brake_val,
            }
            valid_samples.append(sample)

        if not valid_samples:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"All {total_rows} rows in '{source_filename}' were malformed.",
            )

        # Detect observable patterns (speed drops, stops, gaps)
        patterns = self._detect_patterns(valid_samples)

        # Save extracted events to SQLite
        extracted_event_ids: List[str] = []
        for pat in patterns:
            meta = {
                "source_filename": source_filename,
                "row_start": pat.row_start,
                "row_end": pat.row_end,
                "vehicle_id": pat.vehicle_id,
                "evidence_id": evidence_id,
                **pat.metrics,
            }
            ev = create_event(
                ExtractedEventCreate(
                    incident_id=incident_id,
                    source_id=pat.vehicle_id,
                    event_type=pat.pattern_type,
                    description=pat.description,
                    classification=EventClassification.OBSERVATION,
                    wall_clock_timestamp=pat.timestamp_start,
                    wall_clock_end_timestamp=pat.timestamp_end,
                    video_offset_seconds=pat.relative_time_start,
                    video_end_offset_seconds=pat.relative_time_end,
                    evidence_references=[evidence_id],
                    confidence=1.0,
                    metadata=meta,
                )
            )
            extracted_event_ids.append(ev.id)

        # Update evidence processing status
        update_evidence_status(
            evidence_id,
            status=ProcessingStatus.COMPLETED,
            metadata={
                "samples_analyzed": len(valid_samples),
                "malformed_rows": len(validation_errors),
                "patterns_detected": len(patterns),
            },
        )

        # Save analysis run record
        analysis_id = str(uuid4())
        summary = (
            f"Sensor telemetry analysis of '{source_filename}' for vehicle(s) "
            f"{list({s['vehicle_id'] for s in valid_samples})}. "
            f"Processed {len(valid_samples)} valid samples ({len(validation_errors)} malformed rows). "
            f"Identified {len(patterns)} observable kinematic patterns."
        )
        create_analysis_run(
            AnalysisRunCreate(
                incident_id=incident_id,
                run_type="sensor_analysis",
                status=AnalysisRunStatus.COMPLETED,
                summary=summary,
                findings={
                    "analysis_id": analysis_id,
                    "evidence_id": evidence_id,
                    "source_filename": source_filename,
                    "total_rows": total_rows,
                    "valid_samples": len(valid_samples),
                    "patterns_count": len(patterns),
                },
            )
        )

        return SensorAnalysisResponse(
            analysis_id=analysis_id,
            incident_id=incident_id,
            evidence_id=evidence_id,
            source_filename=source_filename,
            total_rows_read=total_rows,
            valid_samples_count=len(valid_samples),
            malformed_rows_count=len(validation_errors),
            malformed_row_errors=validation_errors,
            patterns_detected=patterns,
            extracted_event_ids=extracted_event_ids,
            summary=summary,
        )

    def _detect_patterns(
        self, samples: List[Dict[str, Any]]
    ) -> List[SensorAnomalyOrPattern]:
        """Identify observable physical patterns without inferring collisions or fabricating data."""
        patterns: List[SensorAnomalyOrPattern] = []
        if len(samples) < 2:
            return patterns

        # Group by vehicle_id
        vehicles: Dict[str, List[Dict[str, Any]]] = {}
        for s in samples:
            vehicles.setdefault(s["vehicle_id"], []).append(s)

        for veh_id, veh_samples in vehicles.items():
            for i in range(1, len(veh_samples)):
                prev = veh_samples[i - 1]
                curr = veh_samples[i]

                # Determine time difference (dt)
                dt = None
                if curr["utc_dt"] and prev["utc_dt"]:
                    dt = (curr["utc_dt"] - prev["utc_dt"]).total_seconds()
                elif curr["relative_seconds"] is not None and prev["relative_seconds"] is not None:
                    dt = curr["relative_seconds"] - prev["relative_seconds"]

                # 1. Detect missing data gaps
                if dt is not None and dt > 3.0:
                    patterns.append(
                        SensorAnomalyOrPattern(
                            pattern_type="sensor_data_gap",
                            description=(
                                f"Sensor telemetry gap of {dt:.1f} seconds detected between "
                                f"row {prev['row_number']} and row {curr['row_number']} for {veh_id}. "
                                f"Measurements missing; not fabricated."
                            ),
                            vehicle_id=veh_id,
                            row_start=prev["row_number"],
                            row_end=curr["row_number"],
                            timestamp_start=prev["utc_dt"],
                            timestamp_end=curr["utc_dt"],
                            relative_time_start=prev["relative_seconds"],
                            relative_time_end=curr["relative_seconds"],
                            metrics={"gap_duration_seconds": round(dt, 2)},
                        )
                    )

                # 2. Detect speed decreases / rapid deceleration
                delta_v = curr["speed_kmh"] - prev["speed_kmh"]

                # Computed deceleration rate in m/s^2 if dt available
                accel_rate = None
                if dt and dt > 0:
                    accel_rate = (delta_v * (1000.0 / 3600.0)) / dt

                # Trigger: sudden speed drop of >= 15 km/h or deceleration <= -4.0 m/s^2
                is_rapid_decel = False
                if accel_rate is not None and accel_rate <= -4.0:
                    is_rapid_decel = True
                elif delta_v <= -15.0 and (dt is None or dt <= 2.0):
                    is_rapid_decel = True

                if is_rapid_decel:
                    accel_desc = f" (rate: {accel_rate:.1f} m/s²)" if accel_rate is not None else ""
                    patterns.append(
                        SensorAnomalyOrPattern(
                            pattern_type="rapid_deceleration",
                            description=(
                                f"Significant speed decrease observed for {veh_id} from "
                                f"{prev['speed_kmh']:.1f} km/h to {curr['speed_kmh']:.1f} km/h "
                                f"(delta: {delta_v:.1f} km/h{accel_desc}). "
                                f"Note: Sensor deceleration alone is an observable kinematic metric "
                                f"and does not infer a collision without corroborating physical evidence."
                            ),
                            vehicle_id=veh_id,
                            row_start=prev["row_number"],
                            row_end=curr["row_number"],
                            timestamp_start=prev["utc_dt"],
                            timestamp_end=curr["utc_dt"],
                            relative_time_start=prev["relative_seconds"],
                            relative_time_end=curr["relative_seconds"],
                            metrics={
                                "speed_before_kmh": prev["speed_kmh"],
                                "speed_after_kmh": curr["speed_kmh"],
                                "delta_speed_kmh": round(delta_v, 2),
                                "deceleration_rate_ms2": round(accel_rate, 2) if accel_rate else None,
                            },
                        )
                    )

                # 3. Detect vehicle stopped
                if prev["speed_kmh"] > 5.0 and curr["speed_kmh"] <= 0.5:
                    patterns.append(
                        SensorAnomalyOrPattern(
                            pattern_type="vehicle_stopped",
                            description=(
                                f"Vehicle {veh_id} came to a complete stop (0.0 km/h) at row {curr['row_number']}."
                            ),
                            vehicle_id=veh_id,
                            row_start=curr["row_number"],
                            row_end=curr["row_number"],
                            timestamp_start=curr["utc_dt"],
                            timestamp_end=curr["utc_dt"],
                            relative_time_start=curr["relative_seconds"],
                            relative_time_end=curr["relative_seconds"],
                            metrics={"speed_kmh": 0.0},
                        )
                    )

        return patterns

    async def analyze_evidence_sensor_file(
        self, incident_id: str, evidence_id: str
    ) -> SensorAnalysisResponse:
        """Load evidence record, read CSV from disk, and perform sensor analysis."""
        incident = get_incident(incident_id)
        if not incident:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident with ID '{incident_id}' not found.",
            )

        evidence = get_evidence(evidence_id)
        if not evidence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence with ID '{evidence_id}' not found.",
            )

        if evidence.incident_id != incident_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Evidence '{evidence_id}' does not belong to incident '{incident_id}'.",
            )

        file_path = Path(evidence.storage_reference)
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence file '{file_path.name}' is missing on disk.",
            )

        clean_ext = file_path.suffix.lower()
        if clean_ext not in {".csv", ".tsv", ".txt"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Evidence '{evidence_id}' has file extension '{clean_ext}'. "
                    f"Sensor analysis requires CSV, TSV, or TXT tabular telemetry."
                ),
            )

        csv_bytes = file_path.read_bytes()
        filename = evidence.original_filename or file_path.name

        return self.analyze_csv_data(
            csv_bytes=csv_bytes,
            source_filename=filename,
            incident_id=incident_id,
            evidence_id=evidence_id,
        )


sensor_analysis_service = SensorAnalysisService()
