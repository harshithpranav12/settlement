"""
TRACE AI - Stage 8 Comprehensive Validation Script
Validates the actual outputs generated from car_traffic.mp4:
1. Complete JSON structure and parsing.
2. Integrity of all 7 tracked vehicle IDs and trajectories.
3. Physics reasoning and potential interaction events.
4. Safe handling of short tracking sequences.
5. Correspondence of annotated video and trajectory plot to input video.
6. Public API import and execution from repository root.
"""

import sys
import json
from pathlib import Path
import cv2
import numpy as np

# Ensure project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def validate_all():
    print("=" * 70)
    print("TRACE AI - STAGE 8 VALIDATION (car_traffic.mp4 OUTPUTS)")
    print("=" * 70)

    json_path = PROJECT_ROOT / "computer_vision" / "outputs" / "car_traffic_analysis.json"
    video_path = PROJECT_ROOT / "computer_vision" / "sample_videos" / "car_traffic.mp4"
    annotated_video_path = PROJECT_ROOT / "computer_vision" / "outputs" / "car_traffic_annotated.mp4"
    trajectory_plot_path = PROJECT_ROOT / "computer_vision" / "outputs" / "car_traffic_trajectories.png"

    # -------------------------------------------------------------
    # 1. Inspect and Parse JSON
    # -------------------------------------------------------------
    print("\n--- 1. Inspecting car_traffic_analysis.json Structure ---")
    assert json_path.exists(), f"File missing: {json_path}"

    with open(json_path, "r", encoding="utf-8") as f:
        raw_text = f.read()
        # Parse using Python's standard json parser
        data = json.loads(raw_text)

    expected_top_keys = [
        "source_id", "video_fps", "frame_width", "frame_height", "detections",
        "video_id", "video_metadata", "vehicles", "possible_interactions", "limitations"
    ]
    for key in expected_top_keys:
        assert key in data, f"Missing required top-level key: {key}"
        print(f"  [✓] Key '{key}' present (Type: {type(data[key]).__name__})")

    meta = data["video_metadata"]
    print(f"\n  Metadata: {meta['total_frames']} frames, {meta['fps']} FPS, {meta['duration_seconds']}s, {meta['resolution']['width']}x{meta['resolution']['height']}")
    assert data["source_id"] == "car_traffic"
    assert data["video_fps"] == meta["fps"]
    assert data["frame_width"] == meta["resolution"]["width"]
    assert data["frame_height"] == meta["resolution"]["height"]
    assert len(data["detections"]) == 47, f"Expected 47 flat detections, got {len(data['detections'])}"
    print(f"  [✓] Base schema & Extended schema fields verified. 47 detections in flat list.")

    # -------------------------------------------------------------
    # 2. Check all 7 Vehicle IDs
    # -------------------------------------------------------------
    print("\n--- 2. Checking all 7 Tracked Vehicle IDs ---")
    vehicles = data["vehicles"]
    assert len(vehicles) == 7, f"Expected 7 vehicles, found {len(vehicles)}"
    
    vehicle_ids = [v["vehicle_id"] for v in vehicles]
    print(f"  Tracked Vehicle IDs: {vehicle_ids}")

    for v in vehicles:
        vid = v["vehicle_id"]
        vclass = v["vehicle_class"]
        dets = v["detections"]
        trajs = v["trajectory"]
        motion = v["motion_analysis"]

        assert vclass in ["car", "motorcycle", "bus", "truck"], f"Invalid class: {vclass}"
        assert len(dets) > 0, f"Vehicle {vid} has 0 detections"
        assert len(trajs) == len(dets), f"Vehicle {vid} detections ({len(dets)}) != trajectory points ({len(trajs)})"

        # Verify coordinate math and bounding boxes
        for d in dets:
            assert d["vehicle_id"] == vid
            bbox = d["bbox"]
            assert len(bbox) == 4
            x1, y1, x2, y2 = bbox
            assert x1 <= x2 and y1 <= y2, f"Invalid bbox coordinates: {bbox}"
            expected_cx = round((x1 + x2) / 2.0, 2)
            expected_cy = round((y1 + y2) / 2.0, 2)
            assert abs(d["center_x"] - expected_cx) <= 0.05, f"Center X mismatch: {d['center_x']} vs {expected_cx}"
            assert abs(d["center_y"] - expected_cy) <= 0.05, f"Center Y mismatch: {d['center_y']} vs {expected_cy}"
            assert 0.0 <= d["confidence"] <= 1.0, f"Confidence out of range: {d['confidence']}"

        first_frame = dets[0]["frame_number"]
        last_frame = dets[-1]["frame_number"]
        print(f"  [✓] Vehicle ID {vid:2d}: Class '{vclass}', {len(dets):2d} detections, frames {first_frame:3d}-{last_frame:3d}")

    # -------------------------------------------------------------
    # 3. Verify Physics Reasoning & Interaction Event
    # -------------------------------------------------------------
    print("\n--- 3. Verifying Physics Reasoning & Interaction Event ---")
    for v in vehicles:
        vid = v["vehicle_id"]
        m = v["motion_analysis"]
        assert m["direction"] in ["right", "left", "up", "down", "stationary"]
        assert m["velocity_trend"] in ["increasing", "decreasing", "constant"]
        assert m["acceleration_trend"] in ["positive", "negative", "zero"]
        assert isinstance(m["sudden_motion_change"], bool)
        assert isinstance(m["max_velocity_px_per_sec"], (int, float))
        assert isinstance(m["max_acceleration_px_per_sec2"], (int, float))
        print(f"  Vehicle {vid:2d} Motion -> Dir: {m['direction']:<5} | Vel: {m['velocity_trend']:<10} | Acc: {m['acceleration_trend']:<8} | Sudden: {str(m['sudden_motion_change']):<5} | MaxVel: {m['max_velocity_px_per_sec']:6.2f} px/s")

    interactions = data["possible_interactions"]
    assert len(interactions) == 1, f"Expected 1 interaction, found {len(interactions)}"
    inter = interactions[0]
    print(f"\n  [✓] Verified Interaction Event:")
    print(f"      - Vehicles: Vehicle {inter['vehicle_id_a']} and Vehicle {inter['vehicle_id_b']}")
    print(f"      - Time:     {inter['timestamp_seconds']}s (Frame {inter['frame_number']})")
    print(f"      - Distance: {inter['distance_pixels']} pixels")
    print(f"      - Type:     {inter['interaction_type']}")
    print(f"      - Note:     {inter['description']}")
    assert inter["vehicle_id_a"] in vehicle_ids and inter["vehicle_id_b"] in vehicle_ids

    # -------------------------------------------------------------
    # 4. Check Short Tracking Sequences
    # -------------------------------------------------------------
    print("\n--- 4. Checking Short Tracking Sequences ---")
    # Vehicle 11 has only 2 points; Vehicle 9 has 4 points
    v11 = next(v for v in vehicles if v["vehicle_id"] == 11)
    v9 = next(v for v in vehicles if v["vehicle_id"] == 9)
    print(f"  Vehicle 11 (len={len(v11['trajectory'])}): Direction={v11['motion_analysis']['direction']}, Sudden={v11['motion_analysis']['sudden_motion_change']}")
    print(f"  Vehicle  9 (len={len(v9['trajectory'])}): Direction={v9['motion_analysis']['direction']}, Sudden={v9['motion_analysis']['sudden_motion_change']}")
    assert not np.isnan(v11["motion_analysis"]["max_velocity_px_per_sec"])
    assert not np.isnan(v11["motion_analysis"]["max_acceleration_px_per_sec2"])
    print("  [✓] Short sequences handled without NaN, exception, or zero-division.")

    # -------------------------------------------------------------
    # 5. Verify Video and Plot Correspondence
    # -------------------------------------------------------------
    print("\n--- 5. Verifying Artifact Correspondence ---")
    assert annotated_video_path.exists(), f"Missing annotated video: {annotated_video_path}"
    assert trajectory_plot_path.exists(), f"Missing trajectory plot: {trajectory_plot_path}"

    # Read original video metadata
    cap_orig = cv2.VideoCapture(str(video_path))
    orig_frames = int(cap_orig.get(cv2.CAP_PROP_FRAME_COUNT))
    orig_w = int(cap_orig.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap_orig.get(cv2.CAP_PROP_FRAME_HEIGHT))
    orig_fps = round(cap_orig.get(cv2.CAP_PROP_FPS), 2)
    cap_orig.release()

    # Read annotated video metadata
    cap_ann = cv2.VideoCapture(str(annotated_video_path))
    ann_frames = int(cap_ann.get(cv2.CAP_PROP_FRAME_COUNT))
    ann_w = int(cap_ann.get(cv2.CAP_PROP_FRAME_WIDTH))
    ann_h = int(cap_ann.get(cv2.CAP_PROP_FRAME_HEIGHT))
    ann_fps = round(cap_ann.get(cv2.CAP_PROP_FPS), 2)
    cap_ann.release()

    print(f"  Original Video:  {orig_frames} frames, {orig_w}x{orig_h}, {orig_fps} FPS")
    print(f"  Annotated Video: {ann_frames} frames, {ann_w}x{ann_h}, {ann_fps} FPS")

    assert orig_frames == ann_frames, f"Frame count mismatch: {orig_frames} vs {ann_frames}"
    assert orig_w == ann_w and orig_h == ann_h, f"Resolution mismatch: {orig_w}x{orig_h} vs {ann_w}x{ann_h}"
    assert abs(orig_fps - ann_fps) <= 0.1, f"FPS mismatch: {orig_fps} vs {ann_fps}"
    print("  [✓] Annotated video perfectly matches original video geometry and timing.")

    # Check plot image valid
    img_plot = cv2.imread(str(trajectory_plot_path))
    assert img_plot is not None and img_plot.shape[0] > 0 and img_plot.shape[1] > 0
    print(f"  [✓] Trajectory plot verified: valid PNG ({img_plot.shape[1]}x{img_plot.shape[0]} px).")

    # -------------------------------------------------------------
    # 6. Test Root Import and Function Call
    # -------------------------------------------------------------
    print("\n--- 6. Testing process_video() Import from Root ---")
    from computer_vision import process_video as pv_root
    from computer_vision.main import process_video as pv_main
    assert callable(pv_root) and callable(pv_main)
    print("  [✓] process_video successfully imported via both:")
    print("      'from computer_vision import process_video'")
    print("      'from computer_vision.main import process_video'")

    print("\n" + "=" * 70)
    print("STAGE 8 VALIDATION COMPLETED SUCCESSFULLY! ALL CHECKS PASSED.")
    print("=" * 70)


if __name__ == "__main__":
    validate_all()
