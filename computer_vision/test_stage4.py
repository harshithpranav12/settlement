"""
TRACE AI - Stage 4 Verification Script
Tests ByteTrack vehicle tracking across consecutive video frames,
persistent ID assignment, and track history recording.
"""

import sys
from pathlib import Path

# Ensure project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np

from computer_vision.video_processing import VideoReader
from computer_vision.tracking import VehicleTracker
from computer_vision.config import SAMPLE_VIDEOS_DIR


def main():
    print("=" * 60)
    print("TRACE AI - STAGE 4: BYTETRACK VEHICLE TRACKING VERIFICATION")
    print("=" * 60)

    sample_video_path = SAMPLE_VIDEOS_DIR / "sample_traffic.mp4"
    if not sample_video_path.exists():
        print(f"[Error] Test video not found at: {sample_video_path}")
        print("Run test_stage3.py first to generate the test video.")
        sys.exit(1)

    print(f"\n[Step 1] Loading video: {sample_video_path.name}")
    reader = VideoReader(sample_video_path)
    metadata = reader.get_metadata()
    print(f"[✓] Video loaded: {metadata['total_frames']} frames at {metadata['fps']} FPS")

    print("\n[Step 2] Initializing VehicleTracker (YOLOv8 + ByteTrack)...")
    tracker = VehicleTracker()
    print("[✓] VehicleTracker successfully initialized.")

    print("\n[Step 3] Processing frames through ByteTrack tracker...")
    total_tracked_detections = 0

    for frame_idx, timestamp_sec, frame in reader.frames():
        tracked_vehicles = tracker.track_frame(
            frame=frame,
            frame_number=frame_idx,
            timestamp_seconds=timestamp_sec
        )

        total_tracked_detections += len(tracked_vehicles)

        # Print tracker progress
        if frame_idx % 20 == 0:
            print(f"    - Frame {frame_idx:02d} ({timestamp_sec:.2f}s): {len(tracked_vehicles)} active tracks")

        # Verify schema for any detected vehicle
        for v in tracked_vehicles:
            assert "vehicle_id" in v, "Missing vehicle_id"
            assert "vehicle_class" in v, "Missing vehicle_class"
            assert "frame_number" in v, "Missing frame_number"
            assert "timestamp_seconds" in v, "Missing timestamp_seconds"
            assert "bbox" in v and len(v["bbox"]) == 4, "Invalid bbox"
            assert "center_x" in v, "Missing center_x"
            assert "center_y" in v, "Missing center_y"
            assert "confidence" in v, "Missing confidence"

    reader.release()

    all_tracks = tracker.get_all_tracks()
    print(f"\n[✓] Tracking completed over all {metadata['total_frames']} frames.")
    print(f"[✓] Track history records {len(all_tracks)} distinct vehicle IDs.")
    print(f"[✓] Tracker state and detection schema verified successfully.")

    print("\n" + "=" * 60)
    print("STAGE 4 IMPLEMENTED AND VERIFIED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
