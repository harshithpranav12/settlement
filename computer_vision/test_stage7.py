"""
TRACE AI - Stage 7 Verification Script
Tests visual rendering, annotated video writing, trajectory plotting,
structured JSON export, and the end-to-end process_video() function.
"""

import sys
from pathlib import Path
import json

# Ensure project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np

from computer_vision.config import SAMPLE_VIDEOS_DIR, OUTPUTS_DIR
from computer_vision.trajectory import TrajectoryManager
from computer_vision.visualization import Visualizer
from computer_vision.json_export import JSONExporter
from computer_vision.main import process_video


def main():
    print("=" * 60)
    print("TRACE AI - STAGE 7: VISUALIZATION & JSON EXPORT VERIFICATION")
    print("=" * 60)

    # [Test 1] Test Visualizer & Plotting
    print("\n[Test 1] Testing Trajectory Plot Generation...")
    manager = TrajectoryManager()
    for f in range(30):
        t = f / 30.0
        manager.add_point(vehicle_id=1, frame_number=f, timestamp_seconds=t, x=100 + f * 5, y=200)
        manager.add_point(vehicle_id=2, frame_number=f, timestamp_seconds=t, x=500 - f * 4, y=205)

    visualizer = Visualizer(output_dir=OUTPUTS_DIR)
    plot_path = visualizer.save_trajectory_plot(
        trajectory_manager=manager,
        video_id="test_stage7",
        video_resolution=(640, 480)
    )
    assert plot_path.exists(), f"Plot was not saved at {plot_path}"
    print(f"[✓] Trajectory plot successfully created: {plot_path.name}")

    # [Test 2] Test JSON Exporter
    print("\n[Test 2] Testing JSON Exporter...")
    exporter = JSONExporter(output_dir=OUTPUTS_DIR)
    dummy_payload = exporter.build_payload(
        video_id="test_stage7",
        video_metadata={"fps": 30.0, "total_frames": 30, "duration_seconds": 1.0},
        vehicles_data=[
            {
                "vehicle_id": 1,
                "vehicle_class": "car",
                "detections": [],
                "motion_analysis": {
                    "direction": "right",
                    "velocity_trend": "constant",
                    "acceleration_trend": "zero",
                    "sudden_motion_change": False
                },
                "trajectory": manager.get_trajectory_dict(1)
            }
        ],
        possible_interactions=[],
        limitations=["Unit test limitation."]
    )
    json_path = exporter.save(dummy_payload, filename="test_stage7_analysis.json")
    assert json_path.exists(), f"JSON was not saved at {json_path}"

    with open(json_path, "r", encoding="utf-8") as f:
        loaded = json.load(f)
        assert loaded["video_id"] == "test_stage7"
        assert len(loaded["vehicles"]) == 1
    print(f"[✓] Structured JSON export verified: {json_path.name}")

    # [Test 3] Test End-to-End process_video()
    print("\n[Test 3] Testing End-to-End process_video() API...")
    sample_video = SAMPLE_VIDEOS_DIR / "sample_traffic.mp4"
    result = process_video(
        video_path=sample_video,
        output_dir=OUTPUTS_DIR,
        export_annotated_video=True
    )

    assert isinstance(result, dict), "Result must be a dictionary"
    assert "video_id" in result
    assert "video_metadata" in result
    assert "vehicles" in result
    assert "possible_interactions" in result
    assert "limitations" in result
    assert "artifacts" in result
    assert Path(result["artifacts"]["json_path"]).exists()
    assert Path(result["artifacts"]["trajectory_plot_path"]).exists()
    assert Path(result["artifacts"]["annotated_video_path"]).exists()

    print("[✓] process_video() executed successfully and produced all artifacts:")
    print(f"    - JSON:            {Path(result['artifacts']['json_path']).name}")
    print(f"    - Trajectory Plot: {Path(result['artifacts']['trajectory_plot_path']).name}")
    print(f"    - Annotated Video: {Path(result['artifacts']['annotated_video_path']).name}")

    print("\n" + "=" * 60)
    print("STAGE 7 IMPLEMENTED AND VERIFIED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
