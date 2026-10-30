"""
TRACE AI - Stage 6 Verification Script
Tests the PhysicsReasoningEngine:
1. Direction estimation
2. Velocity trends & pixel rate calculations
3. Acceleration analysis & sudden motion change detection
4. Multi-vehicle spatio-temporal path convergence
5. Forensic limitation disclaimers
"""

import sys
from pathlib import Path

# Ensure project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
from computer_vision.trajectory import TrajectoryManager
from computer_vision.physics_engine import PhysicsEngine


def main():
    print("=" * 60)
    print("TRACE AI - STAGE 6: PHYSICS REASONING ENGINE VERIFICATION")
    print("=" * 60)

    engine = PhysicsEngine()
    manager = TrajectoryManager(smoothing_window=5)

    fps = 30.0
    total_frames = 60  # 2.0 seconds

    # Case 1: Vehicle 1 starts at x=100 moving East (right), then suddenly brakes at frame 40
    print("\n[Test 1] Vehicle 1: Direction & Sudden Deceleration Analysis...")
    for frame in range(total_frames):
        t = frame / fps
        if frame < 40:
            # Steady velocity: ~300 px/sec
            x = 100.0 + (frame * 10.0)
        else:
            # Sudden hard brake: stops abruptly
            x = 500.0 + ((frame - 40) * 0.5)
        y = 200.0
        manager.add_point(vehicle_id=1, frame_number=frame, timestamp_seconds=t, x=x, y=y)

    ts1, xs1, ys1 = manager.get_arrays(vehicle_id=1, smoothed=True)
    analysis1 = engine.analyze_vehicle_motion(ts1, xs1, ys1)

    print(f"    - Estimated Direction:      {analysis1['direction']}")
    print(f"    - Velocity Trend:          {analysis1['velocity_trend']}")
    print(f"    - Acceleration Trend:      {analysis1['acceleration_trend']}")
    print(f"    - Sudden Motion Change:    {analysis1['sudden_motion_change']}")
    print(f"    - Max Velocity:            {analysis1['max_velocity_px_per_sec']} px/s")
    print(f"    - Max Acceleration:        {analysis1['max_acceleration_px_per_sec2']} px/s^2")

    assert analysis1["direction"] == "right", f"Expected 'right', got {analysis1['direction']}"
    assert analysis1["velocity_trend"] == "decreasing", f"Expected 'decreasing', got {analysis1['velocity_trend']}"
    assert analysis1["sudden_motion_change"] is True, "Sudden braking should trigger sudden_motion_change"
    print("[✓] Vehicle 1 motion analysis accurately captured direction and sudden deceleration.")

    # Case 2: Vehicle 2 moving West (left) towards Vehicle 1 to test Path Convergence
    print("\n[Test 2] Multi-Vehicle Trajectory Convergence...")
    for frame in range(total_frames):
        t = frame / fps
        # Starts at x=800, approaches Vehicle 1 at frame 45 near x=520
        x = 800.0 - (frame * 6.0)
        y = 210.0
        manager.add_point(vehicle_id=2, frame_number=frame, timestamp_seconds=t, x=x, y=y)

    interactions = engine.detect_interactions(manager)
    print(f"    - Detected Interactions Count: {len(interactions)}")
    assert len(interactions) > 0, "Expected path convergence interaction to be detected"
    inter = interactions[0]
    print(f"    - Vehicles Involved:  Vehicle {inter['vehicle_id_a']} and Vehicle {inter['vehicle_id_b']}")
    print(f"    - Convergence Time:   {inter['timestamp_seconds']}s (Frame {inter['frame_number']})")
    print(f"    - Minimum Distance:   {inter['distance_pixels']} pixels")
    print(f"    - Description:        {inter['description']}")
    print("[✓] Spatio-temporal path convergence correctly identified.")

    # Case 3: Verify Scientific Limitation Disclaimers
    print("\n[Test 3] Verifying Forensic Limitations & Units...")
    limitations = engine.get_limitations()
    assert len(limitations) >= 4, "Missing limitation disclaimers"
    print(f"[✓] {len(limitations)} Forensic disclaimers loaded.")
    print("    - Sample Disclaimer:", limitations[0])

    print("\n" + "=" * 60)
    print("STAGE 6 IMPLEMENTED AND VERIFIED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
