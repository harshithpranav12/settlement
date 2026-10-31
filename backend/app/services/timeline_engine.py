"""Timeline reconstruction engine for TRACE AI.

Synthesizes normalized events from witness statements, video detections, and sensor processing
into a chronological timeline. Preserves timestamp precision, separates video-relative offsets
from real-world UTC time unless synchronized, supports unknown timestamps, and groups events
into physical occurrences only when adequate supporting evidence exists.
"""

from datetime import datetime, timedelta, timezone
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

from fastapi import HTTPException, status

from app.database import (
    create_analysis_run,
    get_incident,
    list_evidence_for_incident,
    list_events_for_incident,
    list_parties_for_incident,
)
from app.models.analysis_run import AnalysisRunCreate, AnalysisRunStatus
from app.models.enums import EventClassification
from app.models.event import ExtractedEventResponse
from app.models.timeline import (
    TimePrecision,
    TimelineItem,
    TimelineOccurrence,
    TimelineResponse,
    TimelineSyncRequest,
    TimelineTimeType,
    VideoTrackTimeline,
)

logger = logging.getLogger("trace_ai.timeline_engine")

# Semantic event clusters for correlation
DECELERATION_TYPES = {
    "rapid_deceleration",
    "sudden_visual_motion_change",
    "vehicle_stopped",
    "braking",
    "brake_applied",
    "deceleration",
}

COLLISION_TYPES = {
    "collision",
    "impact",
    "collision_impact",
    "visual_trajectory_interaction",
    "crash",
}


def _determine_precision(
    wall_clock: Optional[datetime],
    wall_clock_end: Optional[datetime],
    video_offset: Optional[float],
    video_end_offset: Optional[float],
) -> TimePrecision:
    """Determine recording precision of the event timestamp."""
    if wall_clock_end is not None or video_end_offset is not None:
        return TimePrecision.INTERVAL
    if video_offset is not None:
        return TimePrecision.FRAME
    if wall_clock is not None:
        if wall_clock.microsecond != 0:
            return TimePrecision.MILLISECOND
        if wall_clock.second != 0:
            return TimePrecision.SECOND
        return TimePrecision.MINUTE
    return TimePrecision.UNKNOWN


def _extract_vehicle_entity(event: ExtractedEventResponse) -> Optional[str]:
    """Extract vehicle or party entity key from event fields and metadata."""
    meta = event.metadata or {}
    if meta.get("vehicle_id"):
        return str(meta["vehicle_id"]).strip().upper()
    if meta.get("tracking_id"):
        return str(meta["tracking_id"]).strip().upper()
    if meta.get("party_label"):
        return str(meta["party_label"]).strip().upper()
    if event.source_id:
        src = event.source_id.strip().upper()
        if src in {"V1", "V2"} or "TRACK" in src or "VEH" in src:
            return src
    return None


class TimelineEngineService:
    """Engine responsible for multi-modal timeline reconstruction and event clustering."""

    def build_timeline(
        self,
        incident_id: str,
        sync_request: Optional[TimelineSyncRequest] = None,
    ) -> TimelineResponse:
        """Construct the chronological timeline for an incident."""
        incident = get_incident(incident_id)
        if not incident:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident with ID '{incident_id}' not found.",
            )

        events = list_events_for_incident(incident_id)
        evidence_list = list_evidence_for_incident(incident_id)
        parties = list_parties_for_incident(incident_id)

        evidence_by_id = {e.id: e for e in evidence_list}
        evidence_by_name = {
            (e.original_filename or Path(e.storage_reference).name).lower(): e
            for e in evidence_list
            if e.original_filename or e.storage_reference
        }
        evidence_by_stem = {
            Path(e.original_filename or e.storage_reference).stem.lower(): e
            for e in evidence_list
            if e.original_filename or e.storage_reference
        }

        # Build sync offset mapping: evidence_id -> datetime
        active_sync_offsets: Dict[str, datetime] = {}
        applied_sync_offsets_str: Dict[str, str] = {}

        if sync_request and sync_request.video_sync_offsets:
            for raw_key, sync_dt in sync_request.video_sync_offsets.items():
                ev_match = (
                    evidence_by_id.get(raw_key)
                    or evidence_by_name.get(raw_key.lower())
                    or evidence_by_stem.get(raw_key.lower())
                )
                if ev_match:
                    target_id = ev_match.id
                else:
                    target_id = raw_key
                active_sync_offsets[target_id] = sync_dt
                applied_sync_offsets_str[target_id] = sync_dt.isoformat()

        # Check metadata on evidence for embedded sync timestamps
        for ev in evidence_list:
            if ev.id not in active_sync_offsets:
                ev_meta = ev.metadata or {}
                if "video_start_time" in ev_meta:
                    try:
                        dt = datetime.fromisoformat(str(ev_meta["video_start_time"]))
                        active_sync_offsets[ev.id] = dt
                        applied_sync_offsets_str[ev.id] = dt.isoformat()
                    except (ValueError, TypeError):
                        pass

        timeline_items: List[TimelineItem] = []
        video_track_items: Dict[str, List[TimelineItem]] = {}
        unanchored_items: List[TimelineItem] = []

        for ev in events:
            # 1. Determine time representation and precision
            wall_clock = ev.wall_clock_timestamp
            wall_clock_end = ev.wall_clock_end_timestamp
            vid_offset = ev.video_offset_seconds
            vid_end_offset = ev.video_end_offset_seconds

            duration_sec = None
            if wall_clock and wall_clock_end:
                duration_sec = max(0.0, (wall_clock_end - wall_clock).total_seconds())
            elif vid_offset is not None and vid_end_offset is not None:
                duration_sec = round(max(0.0, vid_end_offset - vid_offset), 3)

            precision = _determine_precision(wall_clock, wall_clock_end, vid_offset, vid_end_offset)

            # Check primary evidence reference for video matching
            primary_ev_id = ev.evidence_references[0] if ev.evidence_references else None
            primary_ev = evidence_by_id.get(primary_ev_id) if primary_ev_id else None
            ev_label = primary_ev.original_filename if primary_ev else (primary_ev_id or "Video")

            is_synced = False
            sync_offset_applied = None

            # Case A: Explicit wall-clock timestamp exists
            if wall_clock is not None:
                time_type = TimelineTimeType.WALL_CLOCK
                display_time = f"{wall_clock.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} UTC"
                if duration_sec:
                    display_time += f" (duration: {duration_sec:.2f}s)"

            # Case B: Video-relative offset exists
            elif vid_offset is not None:
                # Check if this video has a known wall-clock sync anchor
                sync_anchor = active_sync_offsets.get(primary_ev_id) if primary_ev_id else None
                if sync_anchor is not None:
                    time_type = TimelineTimeType.WALL_CLOCK
                    wall_clock = sync_anchor + timedelta(seconds=vid_offset)
                    if vid_end_offset is not None:
                        wall_clock_end = sync_anchor + timedelta(seconds=vid_end_offset)
                    is_synced = True
                    sync_offset_applied = vid_offset
                    display_time = (
                        f"{wall_clock.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} UTC "
                        f"(sync +{vid_offset:.2f}s [{ev_label}])"
                    )
                else:
                    time_type = TimelineTimeType.VIDEO_RELATIVE
                    display_time = f"+{vid_offset:.2f}s [{ev_label}]"
                    if vid_end_offset is not None:
                        display_time = f"+{vid_offset:.2f}s to +{vid_end_offset:.2f}s [{ev_label}]"

            # Case C: Unknown / Unanchored time
            else:
                time_type = TimelineTimeType.UNANCHORED
                display_time = "Time Unknown / Unanchored"

            item = TimelineItem(
                id=ev.id,
                incident_id=incident_id,
                time_type=time_type,
                timestamp=wall_clock,
                end_timestamp=wall_clock_end,
                video_offset_seconds=vid_offset,
                video_end_offset_seconds=vid_end_offset,
                duration_seconds=duration_sec,
                display_time=display_time,
                time_precision=precision,
                is_synchronized=is_synced,
                sync_offset_applied_seconds=sync_offset_applied,
                event_type=ev.event_type,
                classification=ev.classification,
                description=ev.description,
                source_id=ev.source_id,
                evidence_references=ev.evidence_references,
                confidence=ev.confidence,
                metadata=ev.metadata or {},
            )

            timeline_items.append(item)

            if time_type == TimelineTimeType.VIDEO_RELATIVE:
                track_key = primary_ev_id or "unspecified_video"
                video_track_items.setdefault(track_key, []).append(item)
            elif time_type == TimelineTimeType.UNANCHORED:
                unanchored_items.append(item)

        # 2. Chronological Sorting
        def sort_key(item: TimelineItem) -> Tuple[int, float, str]:
            if item.time_type == TimelineTimeType.WALL_CLOCK and item.timestamp:
                return (0, item.timestamp.timestamp(), item.id)
            if item.time_type == TimelineTimeType.VIDEO_RELATIVE and item.video_offset_seconds is not None:
                return (1, item.video_offset_seconds, item.id)
            return (2, 0.0, item.id)

        sorted_timeline = sorted(timeline_items, key=sort_key)

        # 3. Build Video Tracks representation
        video_tracks: Dict[str, VideoTrackTimeline] = {}
        for track_id, items in video_track_items.items():
            ev_record = evidence_by_id.get(track_id)
            fname = ev_record.original_filename if ev_record else track_id
            sorted_track_items = sorted(items, key=lambda x: (x.video_offset_seconds or 0.0, x.id))
            video_tracks[track_id] = VideoTrackTimeline(
                evidence_id=track_id,
                video_filename=fname,
                items_count=len(sorted_track_items),
                is_synchronized=False,
                items=sorted_track_items,
            )

        # 4. Group into Occurrences (Only when adequate supporting information exists)
        occurrences: List[TimelineOccurrence] = []
        should_group = sync_request.group_occurrences if sync_request else True

        if should_group:
            occurrences = self._cluster_occurrences(sorted_timeline)

        return TimelineResponse(
            incident_id=incident_id,
            total_events=len(timeline_items),
            synchronized=bool(active_sync_offsets),
            applied_sync_offsets=applied_sync_offsets_str,
            chronological_timeline=sorted_timeline,
            occurrences=occurrences,
            video_tracks=video_tracks,
            unanchored_events=unanchored_items,
        )

    def _cluster_occurrences(self, items: List[TimelineItem]) -> List[TimelineOccurrence]:
        """Correlate multi-source events into unified occurrences when adequately supported.

        Adequate supporting information requires:
          1. Same entity / vehicle / party reference.
          2. Compatible temporal anchors within proximity threshold (<= 1.5s) or overlapping intervals.
          3. Semantically related action (e.g. deceleration, impact, stopping).
        """
        occurrences: List[TimelineOccurrence] = []
        assigned_ids: Set[str] = set()

        for i, item_a in enumerate(items):
            if item_a.id in assigned_ids:
                continue
            # Unknown timestamps cannot be clustered with temporal confidence
            if item_a.time_type == TimelineTimeType.UNANCHORED:
                continue

            entity_a = _extract_vehicle_entity(
                ExtractedEventResponse(
                    id=item_a.id,
                    incident_id=item_a.incident_id,
                    source_id=item_a.source_id,
                    event_type=item_a.event_type,
                    description=item_a.description,
                    classification=item_a.classification,
                    metadata=item_a.metadata,
                )
            )

            group = [item_a]

            for j in range(i + 1, len(items)):
                item_b = items[j]
                if item_b.id in assigned_ids or item_b.time_type == TimelineTimeType.UNANCHORED:
                    continue

                # Check 1: Time domain compatibility
                if item_a.time_type != item_b.time_type:
                    continue

                # Check 2: Temporal proximity (<= 1.5s)
                time_proximate = False
                if item_a.time_type == TimelineTimeType.WALL_CLOCK and item_a.timestamp and item_b.timestamp:
                    dt_sec = abs((item_a.timestamp - item_b.timestamp).total_seconds())
                    if dt_sec <= 1.5:
                        time_proximate = True
                elif (
                    item_a.time_type == TimelineTimeType.VIDEO_RELATIVE
                    and item_a.video_offset_seconds is not None
                    and item_b.video_offset_seconds is not None
                ):
                    # Must belong to same video stream
                    ref_a = item_a.evidence_references[0] if item_a.evidence_references else None
                    ref_b = item_b.evidence_references[0] if item_b.evidence_references else None
                    if ref_a == ref_b and abs(item_a.video_offset_seconds - item_b.video_offset_seconds) <= 1.5:
                        time_proximate = True

                if not time_proximate:
                    continue

                # Check 3: Entity match
                entity_b = _extract_vehicle_entity(
                    ExtractedEventResponse(
                        id=item_b.id,
                        incident_id=item_b.incident_id,
                        source_id=item_b.source_id,
                        event_type=item_b.event_type,
                        description=item_b.description,
                        classification=item_b.classification,
                        metadata=item_b.metadata,
                    )
                )

                same_entity = entity_a and entity_b and (entity_a == entity_b)

                # Check 4: Semantic action compatibility
                same_action = (
                    (item_a.event_type == item_b.event_type)
                    or (item_a.event_type in DECELERATION_TYPES and item_b.event_type in DECELERATION_TYPES)
                    or (item_a.event_type in COLLISION_TYPES and item_b.event_type in COLLISION_TYPES)
                )

                if same_entity and same_action:
                    group.append(item_b)

            # If adequate supporting information exists across >= 2 events, create an Occurrence
            if len(group) >= 2:
                for member in group:
                    assigned_ids.add(member.id)

                types = list(dict.fromkeys(m.event_type for m in group))
                classifications = list(dict.fromkeys(m.classification for m in group))
                sources = list(dict.fromkeys(m.source_id for m in group if m.source_id))
                ev_refs = list(
                    dict.fromkeys(ref for m in group for ref in m.evidence_references if ref)
                )

                entity_label = entity_a or "Vehicle"
                action_label = types[0].replace("_", " ").title()

                title = f"Corroborated {action_label} ({entity_label})"
                desc = (
                    f"Physical occurrence corroborated by {len(group)} sources "
                    f"({', '.join(s.value for s in classifications)}): "
                    + " | ".join(f"[{m.classification.value}] {m.description}" for m in group)
                )

                conf_scores = [m.confidence for m in group if m.confidence is not None]
                avg_conf = round(sum(conf_scores) / len(conf_scores), 2) if conf_scores else 1.0

                occurrences.append(
                    TimelineOccurrence(
                        title=title,
                        description=desc,
                        time_anchor=group[0].display_time,
                        time_type=group[0].time_type,
                        participating_event_ids=[m.id for m in group],
                        event_types=types,
                        classifications=classifications,
                        sources=sources,
                        evidence_references=ev_refs,
                        supporting_sources_count=len(group),
                        confidence=avg_conf,
                    )
                )

        return occurrences


timeline_engine_service = TimelineEngineService()
