"""Video analysis and computer-vision integration service for TRACE AI.

Ingests machine-vision detection results, validates bounding boxes and timestamps,
generates pixel-space trajectory sequences, converts tracks into normalized
observation events, and records analysis history with strict forensic disclaimers.
"""

from datetime import datetime, timezone
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4

from fastapi import HTTPException, status
from pydantic import ValidationError

from app.database import (
    create_analysis_run,
    create_event,
    get_evidence,
    get_incident,
    list_evidence_for_incident,
    update_evidence_status,
)
from app.models.analysis_run import AnalysisRunCreate, AnalysisRunStatus
from app.models.enums import EventClassification, EvidenceType, ProcessingStatus
from app.models.event import ExtractedEventCreate
from app.models.evidence import EvidenceResponse
from app.models.video_analysis import (
    DetectionItem,
    MotionAnalysisItem,
    PossibleInteractionItem,
    TrajectoryInputPoint,
    TrajectoryPoint,
    TrajectorySequenceInput,
    VehicleTrack,
    VideoAnalysisPayload,
    VideoAnalysisResponse,
    VideoLLMAnalysis,
)

logger = logging.getLogger("trace_ai.video_analysis")

ALLOWED_VIDEO_TYPES = {
    EvidenceType.DASHCAM_VIDEO,
    EvidenceType.CCTV_VIDEO,
    EvidenceType.OTHER,
}

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


class VideoAnalysisService:
    """Service orchestrating computer-vision detections ingestion and trajectory synthesis."""

    def _verify_video_evidence(self, incident_id: str, source_id: str) -> EvidenceResponse:
        """Validate that source_id belongs to an uploaded video for this incident."""
        incident = get_incident(incident_id)
        if not incident:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident with ID '{incident_id}' not found.",
            )

        evidence = get_evidence(source_id)
        if not evidence:
            # Check by original_filename, stem, or storage_reference within the incident
            incident_evidence = list_evidence_for_incident(incident_id)
            for ev in incident_evidence:
                if (
                    ev.id == source_id
                    or ev.original_filename == source_id
                    or (ev.original_filename and Path(ev.original_filename).stem == source_id)
                ):
                    evidence = ev
                    break

        if not evidence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source video evidence '{source_id}' not found.",
            )

        if evidence.incident_id != incident_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Evidence '{source_id}' does not belong to incident '{incident_id}'.",
            )

        # Check if evidence is a video
        is_video_type = evidence.evidence_type in {
            EvidenceType.DASHCAM_VIDEO,
            EvidenceType.CCTV_VIDEO,
        }
        filename = (evidence.original_filename or evidence.storage_reference).lower()
        has_video_ext = any(filename.endswith(ext) for ext in VIDEO_EXTENSIONS)

        if not (is_video_type or has_video_ext):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Evidence '{source_id}' is of type '{evidence.evidence_type.value}' "
                    f"and does not appear to be an uploaded video file."
                ),
            )
        return evidence

    def process_detection_results(
        self,
        incident_id: str,
        detection_data: Union[Dict[str, Any], VideoAnalysisPayload],
    ) -> VideoAnalysisResponse:
        """Integration function callable directly by Python modules or HTTP handlers.

        Accepts either a validated VideoAnalysisPayload or a raw Python dictionary
        matching the computer-vision contract:
          - source_id
          - video_fps
          - frame_width
          - frame_height
          - detections[]:
              - vehicle_id
              - class (or class_name)
              - timestamp_seconds
              - frame_number
              - bbox [x_min, y_min, x_max, y_max] or {x, y, width, height}
              - confidence
          - trajectories[]:
              - vehicle_id
              - points[] (timestamp_seconds, frame_number, center_x, center_y)
          - motion_analysis[]:
              - vehicle_id, velocity_trend, acceleration_trend, sudden_motion_change, ...
          - possible_interactions[]:
              - vehicle_ids, timestamp_seconds, finding, min_image_distance_pixels, ...
        """
        # 1. Pydantic schema validation
        if isinstance(detection_data, VideoAnalysisPayload):
            payload = detection_data
        else:
            try:
                payload = VideoAnalysisPayload.model_validate(detection_data)
            except ValidationError as exc:
                logger.error("CV payload validation failed: %s", exc.errors())
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=exc.errors(),
                ) from exc

        # 2. Source evidence verification
        evidence = self._verify_video_evidence(incident_id, payload.source_id)
        db_evidence_id = evidence.id

        # 3. Group detections, precomputed trajectories, and motion analyses
        grouped_detections: Dict[str, List[DetectionItem]] = {}
        for det in payload.detections:
            grouped_detections.setdefault(det.vehicle_id, []).append(det)

        precomputed_trajectories: Dict[str, List[TrajectoryInputPoint]] = {}
        for traj_seq in (payload.trajectories or []):
            precomputed_trajectories.setdefault(traj_seq.vehicle_id, []).extend(traj_seq.points)

        motion_analysis_map: Dict[str, MotionAnalysisItem] = {}
        for m in (payload.motion_analysis or []):
            motion_analysis_map[m.vehicle_id] = m

        # All unique vehicle IDs from detections, trajectories, and motion analysis
        all_vehicle_ids = list(
            dict.fromkeys(
                list(grouped_detections.keys())
                + list(precomputed_trajectories.keys())
                + list(motion_analysis_map.keys())
            )
        )

        vehicle_tracks: List[VehicleTrack] = []
        extracted_event_ids: List[str] = []
        track_ts_map: Dict[str, float] = {}

        for veh_id in all_vehicle_ids:
            dets = grouped_detections.get(veh_id, [])
            traj_pts_input = precomputed_trajectories.get(veh_id, [])
            motion_summary = motion_analysis_map.get(veh_id)

            pts_by_frame: Dict[int, TrajectoryPoint] = {}

            # Add points from detections
            for d in dets:
                pts_by_frame[d.frame_number] = TrajectoryPoint(
                    frame_number=d.frame_number,
                    timestamp_seconds=d.timestamp_seconds,
                    center_pixel_x=round(d.bbox.center_pixel_x, 2),
                    center_pixel_y=round(d.bbox.center_pixel_y, 2),
                    bbox_width_pixels=round(d.bbox.width_pixels, 2),
                    bbox_height_pixels=round(d.bbox.height_pixels, 2),
                    confidence=round(d.confidence, 4),
                )

            # Merge or add points from precomputed trajectories
            for p in traj_pts_input:
                fn = p.frame_number
                if fn == 0 and p.timestamp_seconds > 0 and payload.video_fps > 0:
                    fn = int(round(p.timestamp_seconds * payload.video_fps))
                if fn in pts_by_frame:
                    existing = pts_by_frame[fn]
                    pts_by_frame[fn] = TrajectoryPoint(
                        frame_number=fn,
                        timestamp_seconds=p.timestamp_seconds,
                        center_pixel_x=round(p.center_x, 2),
                        center_pixel_y=round(p.center_y, 2),
                        bbox_width_pixels=existing.bbox_width_pixels,
                        bbox_height_pixels=existing.bbox_height_pixels,
                        confidence=existing.confidence,
                    )
                else:
                    pts_by_frame[fn] = TrajectoryPoint(
                        frame_number=fn,
                        timestamp_seconds=p.timestamp_seconds,
                        center_pixel_x=round(p.center_x, 2),
                        center_pixel_y=round(p.center_y, 2),
                    )

            sorted_pts = sorted(pts_by_frame.values(), key=lambda pt: (pt.frame_number, pt.timestamp_seconds))

            if sorted_pts:
                first_pt = sorted_pts[0]
                last_pt = sorted_pts[-1]
                first_frame = first_pt.frame_number
                last_frame = last_pt.frame_number
                first_ts = first_pt.timestamp_seconds
                last_ts = last_pt.timestamp_seconds
                duration = round(last_ts - first_ts, 3)
            else:
                first_frame = 0
                last_frame = 0
                first_ts = 0.0
                last_ts = 0.0
                duration = 0.0

            track_ts_map[veh_id] = first_ts
            detected_class = dets[0].class_name if dets else "tracked_vehicle"
            confidences = [d.confidence for d in dets if d.confidence is not None]
            avg_conf = round(sum(confidences) / len(confidences), 4) if confidences else 1.0

            track = VehicleTrack(
                vehicle_id=veh_id,
                tracking_label=f"algorithm_track_{veh_id}_unverified_identity",
                detected_class=detected_class,
                first_frame=first_frame,
                last_frame=last_frame,
                first_timestamp_seconds=first_ts,
                last_timestamp_seconds=last_ts,
                duration_seconds=duration,
                detection_count=len(dets) if dets else len(sorted_pts),
                average_confidence=avg_conf,
                trajectory=sorted_pts,
                motion_summary=motion_summary,
            )
            vehicle_tracks.append(track)

            # 4. Normalized observation event in database for track
            # Forensic Rule: Never claim bounding box proves speed, fault, collision, or liability
            event_desc = (
                f"Machine-vision tracked object '{detected_class}' (Track ID: '{veh_id}', unverified identity) "
                f"observed across {len(sorted_pts)} trajectory points from t={first_ts:.2f}s (frame {first_frame}) "
                f"to t={last_ts:.2f}s (frame {last_frame}). "
                f"Note: Bounding box tracking represents machine-vision observations and does not establish "
                f"calibrated speed, fault, collision, or legal responsibility."
            )

            meta = {
                "source_video_id": db_evidence_id,
                "tracking_id": veh_id,
                "is_verified_identity": False,
                "detected_class": detected_class,
                "frame_start": first_frame,
                "frame_end": last_frame,
                "trajectory_points_count": len(sorted_pts),
                "average_confidence": avg_conf,
            }
            if motion_summary:
                meta["velocity_trend"] = motion_summary.velocity_trend
                meta["acceleration_trend"] = motion_summary.acceleration_trend
                meta["sudden_motion_change"] = motion_summary.sudden_motion_change

            track_event = create_event(
                ExtractedEventCreate(
                    incident_id=incident_id,
                    source_id=f"cv_track_{veh_id}",
                    event_type="visual_object_trajectory",
                    description=event_desc,
                    classification=EventClassification.OBSERVATION,
                    wall_clock_timestamp=None,  # Video-relative; do not guess real-world UTC
                    video_offset_seconds=first_ts,
                    video_end_offset_seconds=last_ts,
                    evidence_references=[db_evidence_id],
                    confidence=avg_conf,
                    metadata=meta,
                )
            )
            extracted_event_ids.append(track_event.id)

        # 5. Process motion analysis items with sudden motion change
        for m in (payload.motion_analysis or []):
            if m.sudden_motion_change:
                veh_ts = track_ts_map.get(m.vehicle_id, 0.0)
                change_desc = (
                    f"Sudden 2D image-plane motion change detected for Track ID '{m.vehicle_id}' "
                    f"(velocity_trend='{m.velocity_trend}', acceleration_trend='{m.acceleration_trend}'). "
                    f"{m.analysis_notes or ''} "
                    f"Note: 2D image-plane motion trends represent pixel-space kinematics and do not prove "
                    f"physical acceleration, emergency braking, collision, or fault."
                ).strip()

                motion_meta = {
                    "source_video_id": db_evidence_id,
                    "tracking_id": m.vehicle_id,
                    "velocity_trend": m.velocity_trend,
                    "acceleration_trend": m.acceleration_trend,
                    "velocity_unit": m.velocity_unit,
                    "acceleration_unit": m.acceleration_unit,
                    "sudden_motion_change": True,
                    "analysis_notes": m.analysis_notes,
                }

                motion_event = create_event(
                    ExtractedEventCreate(
                        incident_id=incident_id,
                        source_id=f"cv_motion_{m.vehicle_id}",
                        event_type="sudden_visual_motion_change",
                        description=change_desc,
                        classification=EventClassification.OBSERVATION,
                        wall_clock_timestamp=None,
                        video_offset_seconds=veh_ts,
                        evidence_references=[db_evidence_id],
                        confidence=0.85,
                        metadata=motion_meta,
                    )
                )
                extracted_event_ids.append(motion_event.id)

        # 6. Process possible spatial-temporal interactions
        for inter in (payload.possible_interactions or []):
            inter_desc = (
                f"Machine-vision interaction pattern '{inter.finding}' observed between tracks "
                f"{inter.vehicle_ids} at t={inter.timestamp_seconds:.2f}s "
                f"(frames: {inter.evidence_frame_numbers}, closest image distance: {inter.min_image_distance_pixels}px). "
                f"Note: 2D image-plane proximity does not prove physical contact, vehicle collision, speed, or liability."
            )

            inter_meta = {
                "source_video_id": db_evidence_id,
                "vehicle_ids": inter.vehicle_ids,
                "finding": inter.finding,
                "min_image_distance_pixels": inter.min_image_distance_pixels,
                "evidence_frame_numbers": inter.evidence_frame_numbers,
                "confidence": inter.confidence,
                "is_physical_contact_proven": False,
            }

            inter_event = create_event(
                ExtractedEventCreate(
                    incident_id=incident_id,
                    source_id=f"cv_interaction_{'_'.join(inter.vehicle_ids)}_{int(inter.timestamp_seconds * 100)}",
                    event_type="visual_trajectory_interaction",
                    description=inter_desc,
                    classification=EventClassification.OBSERVATION,
                    wall_clock_timestamp=None,
                    video_offset_seconds=inter.timestamp_seconds,
                    evidence_references=[db_evidence_id],
                    confidence=inter.confidence,
                    metadata=inter_meta,
                )
            )
            extracted_event_ids.append(inter_event.id)

        # 7. Record analysis run and update evidence status
        analysis_id = str(uuid4())
        summary = (
            f"Computer-vision detection and kinematic ingestion for source video '{payload.source_id}'. "
            f"Processed {len(payload.detections)} raw detections at {payload.video_fps} FPS "
            f"({payload.frame_width}x{payload.frame_height} px). "
            f"Synthesized {len(vehicle_tracks)} tracked trajectories, "
            f"{len(payload.motion_analysis or [])} motion analyses, and "
            f"{len(payload.possible_interactions or [])} spatial-temporal interactions."
        )

        create_analysis_run(
            AnalysisRunCreate(
                incident_id=incident_id,
                run_type="video_analysis",
                status=AnalysisRunStatus.COMPLETED,
                summary=summary,
                findings={
                    "analysis_id": analysis_id,
                    "source_id": payload.source_id,
                    "video_fps": payload.video_fps,
                    "frame_dimensions": f"{payload.frame_width}x{payload.frame_height}",
                    "total_detections": len(payload.detections),
                    "tracked_vehicles": len(vehicle_tracks),
                    "motion_analyses_count": len(payload.motion_analysis or []),
                    "interactions_count": len(payload.possible_interactions or []),
                },
            )
        )

        update_evidence_status(
            db_evidence_id,
            status=ProcessingStatus.COMPLETED,
            metadata={
                "video_analysis_completed": True,
                "detections_processed": len(payload.detections),
                "tracks_identified": len(vehicle_tracks),
                "motion_analyses": len(payload.motion_analysis or []),
                "possible_interactions": len(payload.possible_interactions or []),
            },
        )

        logger.info(
            "Video analysis ingested: incident=%s source=%s tracks=%d detections=%d",
            incident_id,
            payload.source_id,
            len(vehicle_tracks),
            len(payload.detections),
        )

        # 8. LLM Video Observation Assessment & Synthesis
        llm_analysis_obj: Optional[VideoLLMAnalysis] = None
        try:
            from featherless_client import featherless_client
            from app.database import list_parties_for_incident
            parties_records = list_parties_for_incident(incident_id)
            parties_context = [
                {"party_label": p.party_label.value if hasattr(p.party_label, "value") else str(p.party_label), "name": p.name, "statement": p.statement}
                for p in parties_records
            ]
            llm_context = {
                "source_id": payload.source_id,
                "video_fps": payload.video_fps,
                "frame_width": payload.frame_width,
                "frame_height": payload.frame_height,
                "total_detections": len(payload.detections),
                "vehicle_tracks": [
                    {
                        "vehicle_id": t.vehicle_id,
                        "detected_class": t.detected_class,
                        "first_frame": t.first_frame,
                        "last_frame": t.last_frame,
                        "first_timestamp_seconds": t.first_timestamp_seconds,
                        "last_timestamp_seconds": t.last_timestamp_seconds,
                        "duration_seconds": t.duration_seconds,
                        "detection_count": t.detection_count,
                        "velocity_trend": t.motion_summary.velocity_trend if t.motion_summary else None,
                        "acceleration_trend": t.motion_summary.acceleration_trend if t.motion_summary else None,
                    }
                    for t in vehicle_tracks
                ],
                "motion_analysis": [m.model_dump() for m in (payload.motion_analysis or [])],
                "possible_interactions": [inter.model_dump() for inter in (payload.possible_interactions or [])],
                "parties": parties_context,
            }
            raw_llm = featherless_client.analyze_video_observations(llm_context)
            if raw_llm:
                llm_analysis_obj = VideoLLMAnalysis(**raw_llm)
                # Record LLM analysis run in database for persistence
                create_analysis_run(
                    AnalysisRunCreate(
                        incident_id=incident_id,
                        run_type="video_llm_analysis",
                        status=AnalysisRunStatus.COMPLETED,
                        summary=raw_llm.get("narrative_synthesis", "LLM video forensic observation assessment complete."),
                        findings=raw_llm,
                    )
                )
        except Exception as exc:
            logger.warning("LLM video analysis synthesis notice: %s", exc)

        return VideoAnalysisResponse(
            analysis_id=analysis_id,
            incident_id=incident_id,
            source_id=payload.source_id,
            video_fps=payload.video_fps,
            frame_width=payload.frame_width,
            frame_height=payload.frame_height,
            total_detections=len(payload.detections),
            tracked_vehicles_count=len(vehicle_tracks),
            vehicle_tracks=vehicle_tracks,
            motion_analysis=payload.motion_analysis or [],
            possible_interactions=payload.possible_interactions or [],
            extracted_event_ids=extracted_event_ids,
            artifacts=payload.artifacts,
            limitations=payload.limitations,
            summary=summary,
            llm_analysis=llm_analysis_obj,
        )


    async def analyze_video_evidence(
        self,
        incident_id: str,
        evidence_id: str,
        output_dir: Optional[str] = None,
        export_annotated_video: bool = True,
    ) -> VideoAnalysisResponse:
        """Execute computer-vision pipeline on stored video evidence file and ingest results."""
        from starlette.concurrency import run_in_threadpool

        evidence = self._verify_video_evidence(incident_id, evidence_id)
        video_path = Path(evidence.storage_reference).resolve()
        if not video_path.exists():
            from app.config import settings
            repo_root = Path(__file__).resolve().parent.parent.parent.parent
            candidates = [
                Path(settings.UPLOAD_DIR) / evidence.storage_reference,
                repo_root / evidence.storage_reference,
                Path(settings.UPLOAD_DIR) / "incidents" / incident_id / Path(evidence.storage_reference).name,
            ]
            for candidate in candidates:
                if candidate.resolve().exists():
                    video_path = candidate.resolve()
                    break
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Video file for evidence '{evidence_id}' does not exist on disk at '{video_path}'.",
                )

        from computer_vision.main import process_video

        # Output directory: use dedicated subfolder inside incident storage or specified dir
        if output_dir:
            target_out = Path(output_dir).resolve()
        else:
            target_out = video_path.parent / f"cv_outputs_{evidence.id}"
        target_out.mkdir(parents=True, exist_ok=True)

        logger.info(
            "Starting CV pipeline for incident=%s evidence=%s video_path=%s output_dir=%s",
            incident_id,
            evidence.id,
            video_path,
            target_out,
        )

        try:
            cv_results = await run_in_threadpool(
                process_video,
                video_path=video_path,
                output_dir=target_out,
                export_annotated_video=export_annotated_video,
            )
        except Exception as exc:
            logger.error("CV pipeline execution failed for evidence %s: %s", evidence.id, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Computer vision analysis failed: {str(exc)}",
            ) from exc

        # Set source_id to evidence.id so ingestion links directly to the evidence
        cv_results["source_id"] = evidence.id
        return self.process_detection_results(incident_id=incident_id, detection_data=cv_results)


video_analysis_service = VideoAnalysisService()

# Direct convenience function for computer-vision teammate:
process_detection_results = video_analysis_service.process_detection_results
analyze_video_evidence = video_analysis_service.analyze_video_evidence
