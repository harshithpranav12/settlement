"""
TRACE AI - Main Pipeline & Backend Integration Entry Point
Executes end-to-end vehicle detection, ByteTrack tracking, trajectory extraction,
physics reasoning, video annotation, and JSON compilation.

Provides:
- CLI command: python computer_vision/main.py --video <path>
- Callable API: process_video(video_path: str, output_dir: str) -> dict
"""

import sys
import argparse
from pathlib import Path
from typing import Dict, Any, Optional
import cv2

# Ensure project root in sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from computer_vision.config import OUTPUTS_DIR
from computer_vision.video_processing import VideoReader
from computer_vision.tracking import VehicleTracker
from computer_vision.trajectory import TrajectoryManager
from computer_vision.physics_engine import PhysicsEngine
from computer_vision.visualization import Visualizer
from computer_vision.json_export import JSONExporter


def process_video(
    video_path: str | Path,
    output_dir: Optional[str | Path] = None,
    export_annotated_video: bool = True,
) -> Dict[str, Any]:
    """
    Main integration API for TRACE AI.
    Processes an accident video through the computer vision and physics pipeline,
    generates all visual and structured data artifacts, and returns the result.

    Args:
        video_path: Path to the input video file (.mp4, .avi, etc.).
        output_dir: Directory where JSON and visual outputs will be saved.
                    Defaults to computer_vision/outputs.
        export_annotated_video: Whether to render and write the annotated MP4 video.

    Returns:
        Structured dictionary conforming to the TRACE AI timeline schema,
        including file paths to the generated artifacts.
    """
    input_path = Path(video_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input video not found at: {input_path}")

    target_output_dir = Path(output_dir or OUTPUTS_DIR).resolve()
    target_output_dir.mkdir(parents=True, exist_ok=True)
    video_id = input_path.stem

    print("=" * 60)
    print(f"TRACE AI - Processing Video: {input_path.name}")
    print(f"Artifacts will be saved to: {target_output_dir}")
    print("=" * 60)

    # 1. Initialize Pipeline Modules
    reader = VideoReader(input_path)
    metadata = reader.get_metadata()
    fps = metadata["fps"]
    width = metadata["resolution"]["width"]
    height = metadata["resolution"]["height"]
    total_frames = metadata["total_frames"]

    tracker = VehicleTracker()
    trajectory_manager = TrajectoryManager()
    physics_engine = PhysicsEngine()
    visualizer = Visualizer(output_dir=target_output_dir)
    json_exporter = JSONExporter(output_dir=target_output_dir)

    # 2. Setup Video Writer for Annotated Video Output
    video_writer = None
    annotated_video_path = None
    if export_annotated_video:
        annotated_video_path = target_output_dir / f"{video_id}_annotated.mp4"
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        video_writer = cv2.VideoWriter(
            str(annotated_video_path),
            fourcc,
            fps,
            (width, height)
        )

    # 3. Stream & Process Frames
    print(f"[Pipeline] Processing {total_frames} frames ({fps} FPS)...")
    frame_count = 0

    for frame_number, timestamp_sec, frame in reader.frames():
        # Track vehicles with ByteTrack
        tracked_vehicles = tracker.track_frame(
            frame=frame,
            frame_number=frame_number,
            timestamp_seconds=timestamp_sec
        )

        # Record trajectory coordinates
        for v in tracked_vehicles:
            trajectory_manager.add_point(
                vehicle_id=v["vehicle_id"],
                frame_number=frame_number,
                timestamp_seconds=timestamp_sec,
                x=v["center_x"],
                y=v["center_y"]
            )

        # Draw annotations and write frame
        if video_writer is not None:
            annotated_frame = visualizer.draw_frame_annotations(
                frame=frame,
                frame_number=frame_number,
                timestamp_seconds=timestamp_sec,
                tracked_vehicles=tracked_vehicles,
                trajectory_manager=trajectory_manager
            )
            video_writer.write(annotated_frame)

        frame_count += 1
        if frame_count % 30 == 0 or frame_count == total_frames:
            raw_in_frame = tracker.frame_raw_detection_counts.get(frame_number, 0)
            active_in_frame = len(tracked_vehicles)
            print(
                f"    - Frame {frame_count:03d}/{total_frames} ({timestamp_sec:5.2f}s) | "
                f"Raw Detections: {raw_in_frame} | Active Tracks: {active_in_frame}"
            )

    # Clean up video streams
    reader.release()
    if video_writer is not None:
        video_writer.release()
        print(f"[✓] Annotated video saved: {annotated_video_path.name}")

    # Print Debug Tracking Summary
    unique_ids = trajectory_manager.vehicle_ids()
    print("\n" + "=" * 60)
    print("TRACE AI - CV & TRACKING DIAGNOSTIC SUMMARY")
    print("=" * 60)
    print(f"Total Video Frames Processed: {frame_count}")
    print(f"Total Raw Vehicle Detections: {tracker.total_raw_detections}")
    print(f"Total Unique Vehicle IDs:     {len(unique_ids)}")
    print("-" * 60)

    if not unique_ids:
        print("[!] WARNING: 0 vehicles were tracked in this video.")
        print("    Possible causes:")
        print("    - The video does not contain vehicles from the target classes (car, motorcycle, bus, truck).")
        print("    - The video uses synthetic geometric shapes (e.g., flat cv2.rectangle), which YOLO cannot recognize.")
        print("    - Confidence threshold may be too high for low-light/distant footage.")
    else:
        print(f"{'Vehicle ID':<12} | {'Class':<12} | {'Trajectory Points':<18} | {'First Seen':<10} | {'Last Seen':<10}")
        print("-" * 72)
        all_tracks_summary = tracker.get_all_tracks()
        for vid in sorted(unique_ids):
            pts_count = len(trajectory_manager.get_points(vid))
            vinfo = all_tracks_summary.get(vid, {})
            vcls = vinfo.get("vehicle_class", "unknown")
            first_f = vinfo.get("first_seen_frame", 0)
            last_f = vinfo.get("last_seen_frame", 0)
            print(f"{vid:<12} | {vcls:<12} | {pts_count:<18} | Frame {first_f:<4} | Frame {last_f:<4}")
    print("=" * 60 + "\n")

    # 4. Physics Motion Analysis per Vehicle
    print("\n[Pipeline] Running physics reasoning engine on extracted trajectories...")
    all_tracks = tracker.get_all_tracks()
    vehicles_data = []
    sudden_change_ids = set()

    for vid in trajectory_manager.vehicle_ids():
        track_info = all_tracks.get(vid, {})
        vclass = track_info.get("vehicle_class", "vehicle")
        detections = track_info.get("detections", [])

        ts, xs, ys = trajectory_manager.get_arrays(vid, smoothed=True)
        motion_analysis = physics_engine.analyze_vehicle_motion(ts, xs, ys)

        if motion_analysis.get("sudden_motion_change"):
            sudden_change_ids.add(vid)

        trajectory_sequence = trajectory_manager.get_trajectory_dict(vid, smoothed=True)

        vehicles_data.append({
            "vehicle_id": vid,
            "vehicle_class": vclass,
            "detections": detections,
            "motion_analysis": motion_analysis,
            "trajectory": trajectory_sequence,
        })

    # 5. Detect Spatio-Temporal Interactions (Path Convergence)
    print("[Pipeline] Analyzing multi-vehicle path convergence...")
    possible_interactions = physics_engine.detect_interactions(trajectory_manager)
    if possible_interactions:
        print(f"[!] Detected {len(possible_interactions)} potential interaction event(s).")
    else:
        print("[✓] No path convergence anomalies detected.")

    # 6. Generate Trajectory Visualization Plot
    print("[Pipeline] Rendering trajectory reconstruction plot...")
    plot_path = visualizer.save_trajectory_plot(
        trajectory_manager=trajectory_manager,
        video_id=video_id,
        video_resolution=(width, height),
        interactions=possible_interactions
    )
    print(f"[✓] Trajectory plot saved: {plot_path.name}")

    # 7. Compile and Export Structured JSON
    limitations = physics_engine.get_limitations()
    payload = json_exporter.build_payload(
        video_id=video_id,
        video_metadata=metadata,
        vehicles_data=vehicles_data,
        possible_interactions=possible_interactions,
        limitations=limitations,
    )
    json_path = json_exporter.save(payload)
    print(f"[✓] Structured JSON analysis saved: {json_path.name}")

    # Attach generated artifact paths to return dict for backend convenience
    payload["artifacts"] = {
        "json_path": str(json_path),
        "trajectory_plot_path": str(plot_path),
        "annotated_video_path": str(annotated_video_path) if annotated_video_path else None,
    }

    print("=" * 60)
    print(f"PIPELINE COMPLETE: {len(vehicles_data)} vehicles tracked and analyzed.")
    print("=" * 60)

    return payload


def main():
    parser = argparse.ArgumentParser(description="TRACE AI Computer Vision & Physics Pipeline")
    parser.add_argument("--video", "-v", type=str, required=True, help="Path to input accident video file")
    parser.add_argument("--output", "-o", type=str, default=None, help="Directory to save output artifacts")
    parser.add_argument("--no-video", action="store_true", help="Skip rendering annotated MP4 video (faster)")
    args = parser.parse_args()

    process_video(
        video_path=args.video,
        output_dir=args.output,
        export_annotated_video=not args.no_video
    )


if __name__ == "__main__":
    main()
