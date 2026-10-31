"""
TRACE AI - Stage 5 Verification Script
Tests TrajectoryManager collection, moving-average jitter smoothing,
NumPy vectorization, and JSON schema output.
"""

import sys
from pathlib import Path

# Ensure project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
from computer_vision.trajectory import TrajectoryManager


def main():
    print("=" * 60)
    print("TRACE AI - STAGE 5: TRAJECTORY EXTRACTION VERIFICATION")
    print("=" * 60)

    manager = TrajectoryManager(smoothing_window=5)

    print("\n[Step 1] Simulating tracked vehicle detections over time...")
    # Simulate Vehicle 1 moving East (left to right) with simulated detection noise/jitter
    np.random.seed(42)
    fps = 30.0
    total_frames = 60  # 2.0 seconds

    for frame in range(total_frames):
        t = frame / fps
        # Pure linear movement: x moves from 100 to 400
        true_x = 100.0 + (frame * 5.0)
        true_y = 250.0
        # Add realistic detection jitter (+/- 2 pixels)
        jitter_x = true_x + np.random.uniform(-2.0, 2.0)
        jitter_y = true_y + np.random.uniform(-1.5, 1.5)

        manager.add_point(
            vehicle_id=1,
            frame_number=frame,
            timestamp_seconds=t,
            x=jitter_x,
            y=jitter_y
        )

        # Simulate Vehicle 2 moving West (right to left)
        v2_x = 700.0 - (frame * 4.0) + np.random.uniform(-1.0, 1.0)
        v2_y = 255.0 + np.random.uniform(-1.0, 1.0)
        manager.add_point(
            vehicle_id=2,
            frame_number=frame,
            timestamp_seconds=t,
            x=v2_x,
            y=v2_y
        )

    print(f"[✓] Added {total_frames} trajectory frames for Vehicle 1 and Vehicle 2.")

    # [Step 2] Test raw vs smoothed points
    print("\n[Step 2] Testing moving-average smoothing...")
    raw_points = manager.get_points(vehicle_id=1)
    smoothed_dict = manager.get_trajectory_dict(vehicle_id=1, smoothed=True)

    assert len(raw_points) == total_frames, f"Expected {total_frames} points, got {len(raw_points)}"
    assert len(smoothed_dict) == total_frames, f"Smoothed length mismatch: {len(smoothed_dict)}"

    # Check that variance of differences (jitter) is reduced by smoothing
    raw_xs = np.array([p.x for p in raw_points])
    smooth_xs = np.array([d["x"] for d in smoothed_dict])
    raw_diff_var = np.var(np.diff(raw_xs))
    smooth_diff_var = np.var(np.diff(smooth_xs))

    print(f"    - Raw coordinate step variance (with jitter): {raw_diff_var:.4f}")
    print(f"    - Smoothed coordinate step variance:          {smooth_diff_var:.4f}")
    assert smooth_diff_var < raw_diff_var, "Smoothing should reduce frame-to-frame jitter variance"
    print("[✓] Moving-average filter successfully suppressed spatial noise.")

    # [Step 3] Test NumPy array vectorization
    print("\n[Step 3] Testing NumPy array export for physics reasoning...")
    ts, xs, ys = manager.get_arrays(vehicle_id=1, smoothed=True)
    assert isinstance(ts, np.ndarray) and len(ts) == total_frames
    assert isinstance(xs, np.ndarray) and len(xs) == total_frames
    assert isinstance(ys, np.ndarray) and len(ys) == total_frames
    print(f"[✓] Extracted vectorized arrays: timestamps shape {ts.shape}, coords shape ({len(xs)}, 2)")

    # [Step 4] Validate JSON schema compatibility
    print("\n[Step 4] Validating trajectory JSON schema...")
    sample_pt = smoothed_dict[0]
    assert "timestamp_seconds" in sample_pt, "Missing timestamp_seconds"
    assert "x" in sample_pt, "Missing x"
    assert "y" in sample_pt, "Missing y"
    print(f"    - Sample trajectory point: {sample_pt}")
    print("[✓] Trajectory format conforms to backend TRACE AI JSON schema.")

    print("\n" + "=" * 60)
    print("STAGE 5 IMPLEMENTED AND VERIFIED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
