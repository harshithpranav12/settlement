"""
TRACE AI - Vehicle Detection Module
Loads pretrained YOLOv8 model, infers on video frames, filters detections
for target vehicle classes (car, motorcycle, bus, truck), and extracts
spatial coordinates and confidence scores.
"""

from typing import List, Dict, Any, Optional
import numpy as np
from ultralytics import YOLO

try:
    from computer_vision.config import (
        YOLO_MODEL_NAME,
        TARGET_VEHICLE_CLASSES,
        CONFIDENCE_THRESHOLD,
        IOU_THRESHOLD,
    )
except ModuleNotFoundError:
    from config import (
        YOLO_MODEL_NAME,
        TARGET_VEHICLE_CLASSES,
        CONFIDENCE_THRESHOLD,
        IOU_THRESHOLD,
    )


class VehicleDetector:
    """
    Pretrained YOLO vehicle detector that identifies road vehicles
    (cars, motorcycles, buses, trucks) and formats detection metadata.
    """

    def __init__(
        self,
        model_name: str = YOLO_MODEL_NAME,
        conf_threshold: float = CONFIDENCE_THRESHOLD,
        iou_threshold: float = IOU_THRESHOLD,
        target_classes: Optional[Dict[int, str]] = None,
    ):
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.target_classes = target_classes or TARGET_VEHICLE_CLASSES
        
        # Load YOLO model (will automatically download yolov8n.pt ~6MB on first run if needed)
        print(f"[VehicleDetector] Loading model '{model_name}'...")
        self.model = YOLO(model_name)
        print(f"[VehicleDetector] Model loaded successfully. Filtering for: {list(self.target_classes.values())}")

    def detect_frame(
        self,
        frame: np.ndarray,
        frame_number: int = 0,
        timestamp_seconds: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Runs object detection on a single video frame.

        Args:
            frame: OpenCV BGR image array.
            frame_number: 0-indexed frame number.
            timestamp_seconds: Elapsed video time in seconds.

        Returns:
            List of detection dictionaries containing:
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

        # Run YOLO inference filtering strictly by our target COCO vehicle class IDs
        results = self.model.predict(
            source=frame,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            classes=list(self.target_classes.keys()),
            verbose=False,
        )

        detections = []
        if not results or len(results) == 0:
            return detections

        first_res = results[0]
        boxes = first_res.boxes
        if boxes is None or len(boxes) == 0:
            return detections

        for idx, box in enumerate(boxes):
            cls_id = int(box.cls[0].item())
            vehicle_class = self.target_classes.get(cls_id, "unknown_vehicle")
            
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0].item())
            
            # Compute center of the bounding box
            center_x = (x1 + x2) / 2.0
            center_y = (y1 + y2) / 2.0

            detections.append({
                "detection_index": idx,
                "vehicle_class": vehicle_class,
                "frame_number": frame_number,
                "timestamp_seconds": round(timestamp_seconds, 3),
                "bbox": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                "center_x": round(center_x, 2),
                "center_y": round(center_y, 2),
                "confidence": round(conf, 3),
            })

        return detections
