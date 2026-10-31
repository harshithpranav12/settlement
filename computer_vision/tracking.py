"""
TRACE AI - Vehicle Tracking Module
Integrates ByteTrack with YOLOv8 to track vehicles across consecutive frames,
assign persistent tracking IDs, and manage vehicle state over time.
"""

import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
from ultralytics import YOLO

# Ensure project root in sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

try:
    from computer_vision.config import (
        YOLO_MODEL_NAME,
        TARGET_VEHICLE_CLASSES,
        CONFIDENCE_THRESHOLD,
        IOU_THRESHOLD,
        TRACKER_CONFIG,
    )
except ModuleNotFoundError:
    from config import (
        YOLO_MODEL_NAME,
        TARGET_VEHICLE_CLASSES,
        CONFIDENCE_THRESHOLD,
        IOU_THRESHOLD,
        TRACKER_CONFIG,
    )


class VehicleTracker:
    """
    Multi-object vehicle tracker using ByteTrack.
    Associates vehicle detections across video frames and assigns
    persistent unique tracking IDs.
    """

    def __init__(
        self,
        model_name: str = YOLO_MODEL_NAME,
        conf_threshold: float = CONFIDENCE_THRESHOLD,
        iou_threshold: float = IOU_THRESHOLD,
        tracker_type: str = TRACKER_CONFIG,
        target_classes: Optional[Dict[int, str]] = None,
    ):
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.tracker_type = tracker_type
        self.target_classes = target_classes or TARGET_VEHICLE_CLASSES
        
        print(f"[VehicleTracker] Initializing tracker with model '{model_name}' and tracker '{tracker_type}'...")
        self.model = YOLO(model_name)
        
        # Vehicle track store: maps vehicle_id -> dict of vehicle history
        self.active_tracks: Dict[int, Dict[str, Any]] = {}
        # Debug statistics counters
        self.total_raw_detections = 0
        self.frame_raw_detection_counts: Dict[int, int] = {}

    def reset(self) -> None:
        """
        Resets the internal tracking state. Call this before processing a new video
        to avoid carrying over IDs or Kalman filter states.
        """
        self.active_tracks.clear()
        self.total_raw_detections = 0
        self.frame_raw_detection_counts.clear()
        # Reset predictor tracker state if supported
        if hasattr(self.model, "predictor") and self.model.predictor is not None:
            self.model.predictor.trackers = None

    def track_frame(
        self,
        frame: np.ndarray,
        frame_number: int,
        timestamp_seconds: float,
    ) -> List[Dict[str, Any]]:
        """
        Tracks vehicles in the current frame using ByteTrack.

        Args:
            frame: OpenCV BGR image array.
            frame_number: Current 0-indexed frame count.
            timestamp_seconds: Video elapsed time in seconds.

        Returns:
            List of tracked vehicle detection dictionaries for this frame:
                - vehicle_id (int): ByteTrack persistent tracking ID
                - vehicle_class (str): 'car', 'motorcycle', 'bus', 'truck'
                - frame_number (int)
                - timestamp_seconds (float)
                - bbox (list[float]): [x1, y1, x2, y2]
                - center_x (float)
                - center_y (float)
                - confidence (float)
        """
        if frame is None or frame.size == 0:
            return []

        # Run tracking with persist=True so ByteTrack maintains identity between calls
        results = self.model.track(
            source=frame,
            persist=True,
            tracker=self.tracker_type,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            classes=list(self.target_classes.keys()),
            verbose=False,
        )

        frame_tracks: List[Dict[str, Any]] = []
        if not results or len(results) == 0:
            self.frame_raw_detection_counts[frame_number] = 0
            return frame_tracks

        first_res = results[0]
        boxes = first_res.boxes
        if boxes is None or len(boxes) == 0:
            self.frame_raw_detection_counts[frame_number] = 0
            return frame_tracks

        raw_count = len(boxes)
        self.total_raw_detections += raw_count
        self.frame_raw_detection_counts[frame_number] = raw_count

        for box in boxes:
            # Check if ByteTrack has assigned an ID to this box
            if box.id is None:
                # Detection unconfirmed or pending association by tracker
                continue

            vehicle_id = int(box.id[0].item())
            cls_id = int(box.cls[0].item())
            vehicle_class = self.target_classes.get(cls_id, "unknown_vehicle")
            
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            # Clamp bounding boxes to valid frame boundaries to prevent model subpixel boundary drift
            h, w = frame.shape[:2]
            x1 = max(0.0, min(float(w - 1.0), float(x1)))
            y1 = max(0.0, min(float(h - 1.0), float(y1)))
            x2 = max(x1 + 1.0, min(float(w), float(x2)))
            y2 = max(y1 + 1.0, min(float(h), float(y2)))
            conf = float(box.conf[0].item())
            center_x = (x1 + x2) / 2.0
            center_y = (y1 + y2) / 2.0

            detection_record = {
                "vehicle_id": vehicle_id,
                "vehicle_class": vehicle_class,
                "frame_number": frame_number,
                "timestamp_seconds": round(timestamp_seconds, 3),
                "bbox": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                "center_x": round(center_x, 2),
                "center_y": round(center_y, 2),
                "confidence": round(conf, 3),
            }

            frame_tracks.append(detection_record)

            # Update vehicle history store
            if vehicle_id not in self.active_tracks:
                self.active_tracks[vehicle_id] = {
                    "vehicle_id": vehicle_id,
                    "vehicle_class": vehicle_class,
                    "detections": [],
                    "first_seen_frame": frame_number,
                    "last_seen_frame": frame_number,
                }

            self.active_tracks[vehicle_id]["detections"].append(detection_record)
            self.active_tracks[vehicle_id]["last_seen_frame"] = frame_number

        return frame_tracks

    def get_all_tracks(self) -> Dict[int, Dict[str, Any]]:
        """Returns the dictionary of all tracked vehicles across the video."""
        return self.active_tracks
