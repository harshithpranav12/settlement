"""
TRACE AI - Computer Vision & Physics Reasoning Configuration
Centralized configuration parameters for vehicle detection, tracking,
physics reasoning, and export paths.
"""

from pathlib import Path

# Base Paths
MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = MODULE_DIR.parent
OUTPUTS_DIR = MODULE_DIR / "outputs"
SAMPLE_VIDEOS_DIR = MODULE_DIR / "sample_videos"

# Ensure output directories exist
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

# Pretrained Model Configuration
# We use YOLOv8n (nano), a fast ~6MB model optimized for CPU real-time inference
YOLO_MODEL_NAME = "yolov8n.pt"

# COCO Dataset Vehicle Class IDs to filter:
# 2: car, 3: motorcycle, 5: bus, 7: truck
TARGET_VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

# Detection Parameters
CONFIDENCE_THRESHOLD = 0.30  # Minimum confidence to accept a detection
IOU_THRESHOLD = 0.45         # NMS IoU threshold

# Tracking Configuration (ByteTrack)
TRACKER_CONFIG = "bytetrack.yaml"  # Built-in Ultralytics ByteTrack configuration
TRACK_BUFFER_FRAMES = 30           # Number of frames to keep lost tracks alive

# Physics Reasoning Parameters
# Smoothing window for center coordinates to suppress pixel jitter/noise
SMOOTHING_WINDOW = 5

# Motion trend thresholds (in image-plane pixels/second and pixels/second^2)
VELOCITY_EPSILON = 5.0             # Absolute px/s change below which velocity is "constant"
ACCELERATION_EPSILON = 10.0        # px/s^2 below which acceleration is negligible
SUDDEN_MOTION_CHANGE_THRESHOLD = 250.0  # px/s^2 threshold for sudden motion change / abrupt braking

# Spatial-temporal interaction threshold (in image-plane pixels and time window)
INTERACTION_DISTANCE_THRESHOLD = 60.0  # Pixels proximity threshold for convergence
INTERACTION_TIME_WINDOW = 0.5          # Time delta window in seconds for interaction check

# Scientific & Legal Limitation Disclaimers (forensic accuracy)
EVIDENCE_LIMITATIONS = [
    "All velocities and accelerations are measured strictly in 2D image-plane pixels per second (px/s) and px/s^2.",
    "Image-plane pixel measurements CANNOT be directly converted to real-world metric speed (km/h or mph) without camera calibration, intrinsic/extrinsic parameters, and physical ground distance references.",
    "Camera perspective distortion, tilt angle, lens distortion, and distance from camera significantly affect pixel displacement rates.",
    "Trajectory convergence and sudden motion changes represent possible interactions in the 2D video plane, NOT confirmed physical collisions or liability determinations.",
    "Occlusions, lighting changes, camera motion, and tracking ID switches may cause temporary tracking gaps or ID reassignment."
]
