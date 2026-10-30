"""
TRACE AI - Computer Vision & Physics Reasoning Module
"""

import sys
from pathlib import Path

# Ensure project root is accessible in sys.path for all module imports
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from computer_vision.video_processing import VideoReader
from computer_vision.detection import VehicleDetector
from computer_vision.tracking import VehicleTracker
from computer_vision.trajectory import TrajectoryManager
from computer_vision.physics_engine import PhysicsEngine
from computer_vision.visualization import Visualizer
from computer_vision.json_export import JSONExporter
from computer_vision.main import process_video
from computer_vision.config import (
    YOLO_MODEL_NAME,
    TARGET_VEHICLE_CLASSES,
    CONFIDENCE_THRESHOLD,
    IOU_THRESHOLD,
    OUTPUTS_DIR,
    SAMPLE_VIDEOS_DIR,
)

__all__ = [
    "VideoReader",
    "VehicleDetector",
    "VehicleTracker",
    "TrajectoryManager",
    "PhysicsEngine",
    "Visualizer",
    "JSONExporter",
    "process_video",
    "YOLO_MODEL_NAME",
    "TARGET_VEHICLE_CLASSES",
    "CONFIDENCE_THRESHOLD",
    "IOU_THRESHOLD",
    "OUTPUTS_DIR",
    "SAMPLE_VIDEOS_DIR",
]
