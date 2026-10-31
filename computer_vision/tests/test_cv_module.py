"""
TRACE AI - Computer Vision & Physics Reasoning Test Suite
Unit and integration tests for video processing, trajectory extraction,
physics reasoning, missing detection handling, and JSON schema formatting.
Uses synthetic coordinates for physics to execute swiftly without GPU requirements.
"""

import sys
import json
from pathlib import Path
import pytest
import numpy as np

# Ensure project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from computer_vision.video_processing import VideoReader
from computer_vision.trajectory import TrajectoryManager, TrajectoryPoint
from computer_vision.physics_engine import PhysicsEngine
from computer_vision.json_export import JSONExporter
from computer_vision.config import SAMPLE_VIDEOS_DIR, OUTPUTS_DIR


# ----------------------------------------------------------------------
# 1. Video Processing & Timestamp Calculation Tests
# ----------------------------------------------------------------------

def test_video_reader_loading_and_timestamps():
    """Verifies video loading, metadata extraction, and timestamp monotonicity."""
    sample_video = SAMPLE_VIDEOS_DIR / "sample_traffic.mp4"
    assert sample_video.exists(), "Sample traffic video should exist"

    with VideoReader(sample_video) as reader:
        meta = reader.get_metadata()
        assert "fps" in meta and meta["fps"] > 0
        assert "total_frames" in meta and meta["total_frames"] > 0
        assert "resolution" in meta
        assert meta["resolution"]["width"] > 0
        assert meta["resolution"]["height"] > 0

        prev_time = -1.0
        frame_count = 0
        for f_idx, t_sec, frame in reader.frames():
            assert f_idx == frame_count
            assert t_sec > prev_time  # Timestamps must increase monotonically
            assert frame is not None and frame.shape[:2] == (meta["resolution"]["height"], meta["resolution"]["width"])
            prev_time = t_sec
            frame_count += 1
            if frame_count >= 10:  # Sample first 10 frames
                break


def test_video_reader_nonexistent_file():
    """Verifies that an invalid file path raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError):
        VideoReader("non_existent_video_path_12345.mp4")


# ----------------------------------------------------------------------
# 2. Trajectory Extraction & Jitter Smoothing Tests
# ----------------------------------------------------------------------

def test_trajectory_manager_jitter_reduction():
    """Verifies that moving-average filter suppresses noise while keeping array length."""
    manager = TrajectoryManager(smoothing_window=5)
    np.random.seed(42)
    n_points = 30
    fps = 30.0

    for f in range(n_points):
        t = f / fps
        true_x = 100.0 + (f * 4.0)
        noisy_x = true_x + np.random.uniform(-3.0, 3.0)
        manager.add_point(vehicle_id=1, frame_number=f, timestamp_seconds=t, x=noisy_x, y=200.0)

    raw_points = manager.get_points(1)
    assert len(raw_points) == n_points

    ts, smooth_xs, smooth_ys = manager.get_arrays(1, smoothed=True)
    assert len(ts) == n_points
    assert len(smooth_xs) == n_points

    raw_xs = np.array([p.x for p in raw_points])
    raw_var = np.var(np.diff(raw_xs))
    smooth_var = np.var(np.diff(smooth_xs))
    assert smooth_var < raw_var, "Smoothed trajectory variance must be lower than raw jitter"


def test_trajectory_manager_missing_frames():
    """Verifies that missing frames or temporary tracking gaps do not crash manager."""
    manager = TrajectoryManager(smoothing_window=5)
    # Simulate vehicle observed at frame 0, 1, 2, then disappears for 5 frames, seen at 8, 9
    observed_frames = [0, 1, 2, 8, 9]
    for f in observed_frames:
        manager.add_point(vehicle_id=1, frame_number=f, timestamp_seconds=f * 0.1, x=100.0 + f * 5, y=150.0)

    pts = manager.get_points(1)
    assert len(pts) == 5
    ts, xs, ys = manager.get_arrays(1, smoothed=True)
    assert len(xs) == 5
    assert len(ts) == 5


# ----------------------------------------------------------------------
# 3. Physics Reasoning Engine Tests (Deterministic Synthetic Data)
# ----------------------------------------------------------------------

def test_physics_velocity_and_acceleration_calculation():
    """Verifies exact deterministic velocity and acceleration calculations."""
    engine = PhysicsEngine(velocity_epsilon=5.0, acceleration_epsilon=10.0)

    # 1. Constant velocity motion: moves 30 pixels every 0.1 seconds = 300 px/s
    dt = 0.1
    timestamps = np.array([0.0, 0.1, 0.2, 0.3, 0.4])
    xs = np.array([0.0, 30.0, 60.0, 90.0, 120.0])
    ys = np.array([100.0, 100.0, 100.0, 100.0, 100.0])

    analysis = engine.analyze_vehicle_motion(timestamps, xs, ys)
    assert analysis["direction"] == "right"
    assert analysis["velocity_trend"] == "constant"
    assert pytest.approx(analysis["max_velocity_px_per_sec"], abs=2.0) == 300.0
    assert analysis["sudden_motion_change"] is False


def test_physics_sudden_motion_change_detection():
    """Verifies detection of sudden deceleration (hard braking event)."""
    engine = PhysicsEngine(sudden_change_threshold=200.0)

    # Vehicle cruising at 400 px/s then abruptly halts
    timestamps = np.array([0.0, 0.1, 0.2, 0.3, 0.4, 0.5])
    xs = np.array([0.0, 40.0, 80.0, 120.0, 122.0, 123.0])  # Halts after 0.3s
    ys = np.full(6, 200.0)

    analysis = engine.analyze_vehicle_motion(timestamps, xs, ys)
    assert analysis["velocity_trend"] == "decreasing"
    assert analysis["sudden_motion_change"] is True
    assert len(analysis["sudden_change_events"]) > 0
    assert analysis["sudden_change_events"][0]["nature"] == "abrupt_deceleration"


def test_physics_insufficient_data_safety():
    """Verifies that 0 or 1 point trajectories safely return defaults without crashing."""
    engine = PhysicsEngine()

    # Empty trajectory
    empty_res = engine.analyze_vehicle_motion(np.empty(0), np.empty(0), np.empty(0))
    assert empty_res["direction"] == "stationary"
    assert empty_res["sudden_motion_change"] is False

    # Single point
    single_res = engine.analyze_vehicle_motion(np.array([0.5]), np.array([100.0]), np.array([200.0]))
    assert single_res["direction"] == "stationary"
    assert single_res["max_velocity_px_per_sec"] == 0.0


def test_physics_spatio_temporal_convergence():
    """Verifies multi-vehicle convergence detection considers both distance and time."""
    engine = PhysicsEngine(interaction_distance_threshold=50.0, interaction_time_window=0.5)
    manager = TrajectoryManager()

    # Vehicle 1 and Vehicle 2 pass within 15 pixels of each other at t=1.0s
    for f in range(20):
        t = f * 0.1
        manager.add_point(vehicle_id=1, frame_number=f, timestamp_seconds=t, x=100.0 + f * 10, y=200.0)
        # Vehicle 2 approaches from opposite direction
        manager.add_point(vehicle_id=2, frame_number=f, timestamp_seconds=t, x=300.0 - f * 10, y=210.0)

    interactions = engine.detect_interactions(manager)
    assert len(interactions) == 1
    assert interactions[0]["interaction_type"] == "path_convergence"
    assert interactions[0]["distance_pixels"] < 50.0
    assert pytest.approx(interactions[0]["timestamp_seconds"], abs=0.2) == 1.0


# ----------------------------------------------------------------------
# 4. JSON Export & Schema Conformance Tests
# ----------------------------------------------------------------------

def test_json_export_base_and_extended_schema(tmp_path):
    """Validates that exported JSON fulfills both base and extended schemas."""
    exporter = JSONExporter(output_dir=tmp_path)
    video_meta = {
        "fps": 30.0,
        "total_frames": 100,
        "duration_seconds": 3.33,
        "resolution": {"width": 1920, "height": 1080}
    }
    vehicles = [
        {
            "vehicle_id": 1,
            "vehicle_class": "car",
            "detections": [
                {
                    "vehicle_id": 1,
                    "frame_number": 10,
                    "timestamp_seconds": 0.33,
                    "bbox": [100.0, 100.0, 200.0, 200.0],
                    "center_x": 150.0,
                    "center_y": 150.0,
                    "confidence": 0.95
                }
            ],
            "motion_analysis": {
                "direction": "right",
                "velocity_trend": "constant",
                "acceleration_trend": "zero",
                "sudden_motion_change": False
            },
            "trajectory": [{"timestamp_seconds": 0.33, "x": 150.0, "y": 150.0}]
        }
    ]
    payload = exporter.build_payload(
        video_id="unit_test_clip",
        video_metadata=video_meta,
        vehicles_data=vehicles,
        possible_interactions=[],
        limitations=["Unit test limitation."]
    )

    out_file = exporter.save(payload, filename="test_output.json")
    assert out_file.exists()

    with open(out_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Base Schema Requirements
    assert data["source_id"] == "unit_test_clip"
    assert data["video_fps"] == 30.0
    assert data["frame_width"] == 1920
    assert data["frame_height"] == 1080
    assert isinstance(data["detections"], list)
    assert len(data["detections"]) == 1

    # Extended Forensic Schema Requirements
    assert "video_metadata" in data
    assert "vehicles" in data and len(data["vehicles"]) == 1
    assert "possible_interactions" in data
    assert "limitations" in data
