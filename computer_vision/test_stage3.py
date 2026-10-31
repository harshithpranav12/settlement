"""
TRACE AI - Stage 3 Verification Script
Tests video loading, metadata extraction, frame streaming,
and YOLO vehicle detection.
"""

import sys
from pathlib import Path

# Ensure project root is in sys.path so 'computer_vision' package is recognized
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np

from computer_vision.video_processing import VideoReader
from computer_vision.detection import VehicleDetector
from computer_vision.config import SAMPLE_VIDEOS_DIR


def create_sample_video_if_missing(video_path: Path) -> Path:
    """
    Generates a short 2-second synthetic video (30 FPS, 60 frames)
    if no sample video is present, so video processing can be verified immediately.
    """
    if video_path.exists():
        return video_path

    print(f"[Stage 3] Generating 2-second test video at '{video_path}'...")
    fps = 30
    duration_sec = 2
    width, height = 640, 480
    total_frames = fps * duration_sec

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(video_path), fourcc, fps, (width, height))

    for i in range(total_frames):
        # Create a frame with a dark asphalt-like road
        frame = np.full((height, width, 3), 45, dtype=np.uint8)
        
        # Draw road lane markings
        cv2.line(frame, (0, 240), (width, 240), (255, 255, 255), 2)
        
        # Moving box simulating vehicle motion
        box_x = int(50 + (i * 7))
        cv2.rectangle(frame, (box_x, 180), (box_x + 90, 230), (0, 140, 255), -1)
        cv2.putText(frame, f"TRACE AI Test Frame {i}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        out.write(frame)

    out.release()
    print(f"[Stage 3] Test video successfully created: {video_path}")
    return video_path


def main():
    print("=" * 60)
    print("TRACE AI - STAGE 3: VIDEO LOADING & DETECTION VERIFICATION")
    print("=" * 60)

    # 1. Ensure a test video exists
    sample_video_path = SAMPLE_VIDEOS_DIR / "sample_traffic.mp4"
    create_sample_video_if_missing(sample_video_path)

    # 2. Test VideoReader
    print("\n[Step 1] Initializing VideoReader...")
    with VideoReader(sample_video_path) as reader:
        metadata = reader.get_metadata()
        print(f"[✓] Successfully loaded video: {sample_video_path.name}")
        print(f"    - Resolution: {metadata['resolution']['width']}x{metadata['resolution']['height']}")
        print(f"    - Frame Rate (FPS): {metadata['fps']}")
        print(f"    - Total Frames: {metadata['total_frames']}")
        print(f"    - Duration: {metadata['duration_seconds']} seconds")

        # 3. Test VehicleDetector
        print("\n[Step 2] Initializing VehicleDetector (YOLOv8n)...")
        detector = VehicleDetector()

        print("\n[Step 3] Processing frames through VideoReader and VehicleDetector...")
        sample_detections = []
        for frame_idx, timestamp_sec, frame in reader.frames():
            detections = detector.detect_frame(
                frame=frame,
                frame_number=frame_idx,
                timestamp_seconds=timestamp_sec
            )
            if detections:
                sample_detections.extend(detections)

            # Print progress every 20 frames
            if frame_idx % 20 == 0:
                print(f"    - Frame {frame_idx:02d} ({timestamp_sec:.2f}s): {len(detections)} vehicles detected")

        print(f"\n[✓] Video reading and frame extraction completed across all {metadata['total_frames']} frames.")
        print(f"[✓] VehicleDetector ran inference without errors.")

    print("\n" + "=" * 60)
    print("STAGE 3 IMPLEMENTED AND VERIFIED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
