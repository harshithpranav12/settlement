"""
TRACE AI - Physics Reasoning Engine
Computes 2D image-plane velocity, acceleration, heading directions,
detects sudden motion anomalies, identifies multi-vehicle spatio-temporal
convergence, and embeds forensic evidence limitations.
"""

import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import numpy as np

# Ensure project root in sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

try:
    from computer_vision.config import (
        VELOCITY_EPSILON,
        ACCELERATION_EPSILON,
        SUDDEN_MOTION_CHANGE_THRESHOLD,
        INTERACTION_DISTANCE_THRESHOLD,
        INTERACTION_TIME_WINDOW,
        EVIDENCE_LIMITATIONS,
    )
    from computer_vision.trajectory import TrajectoryManager
except ModuleNotFoundError:
    from config import (
        VELOCITY_EPSILON,
        ACCELERATION_EPSILON,
        SUDDEN_MOTION_CHANGE_THRESHOLD,
        INTERACTION_DISTANCE_THRESHOLD,
        INTERACTION_TIME_WINDOW,
        EVIDENCE_LIMITATIONS,
    )
    from trajectory import TrajectoryManager


class PhysicsEngine:
    """
    Performs deterministic physics reasoning on 2D image-plane coordinates.
    All kinematic values are strictly measured in pixels and seconds.
    """

    def __init__(
        self,
        velocity_epsilon: float = VELOCITY_EPSILON,
        acceleration_epsilon: float = ACCELERATION_EPSILON,
        sudden_change_threshold: float = SUDDEN_MOTION_CHANGE_THRESHOLD,
        interaction_distance_threshold: float = INTERACTION_DISTANCE_THRESHOLD,
        interaction_time_window: float = INTERACTION_TIME_WINDOW,
    ):
        self.vel_eps = velocity_epsilon
        self.acc_eps = acceleration_epsilon
        self.sudden_threshold = sudden_change_threshold
        self.interaction_dist_thresh = interaction_distance_threshold
        self.interaction_time_win = interaction_time_window

    def analyze_vehicle_motion(
        self,
        timestamps: np.ndarray,
        xs: np.ndarray,
        ys: np.ndarray,
    ) -> Dict[str, Any]:
        """
        Analyzes direction, velocity trend, acceleration trend, and sudden
        motion changes for a single vehicle trajectory.

        Args:
            timestamps: 1D array of elapsed time in seconds.
            xs: 1D array of x coordinates (pixels).
            ys: 1D array of y coordinates (pixels).

        Returns:
            Dictionary matching the motion_analysis schema:
                - direction (str): 'right', 'left', 'up', 'down', 'stationary'
                - velocity_trend (str): 'increasing', 'decreasing', 'constant'
                - acceleration_trend (str): 'positive', 'negative', 'zero'
                - sudden_motion_change (bool)
                - max_velocity_px_per_sec (float)
                - max_acceleration_px_per_sec2 (float)
                - sudden_change_events (list[dict])
        """
        n_points = len(timestamps)

        # Baseline default for stationary or single-frame track
        if n_points < 2:
            return {
                "direction": "stationary",
                "velocity_trend": "constant",
                "acceleration_trend": "zero",
                "sudden_motion_change": False,
                "max_velocity_px_per_sec": 0.0,
                "max_acceleration_px_per_sec2": 0.0,
                "sudden_change_events": [],
            }

        # 1. Direction Analysis
        direction = self._calculate_direction(xs, ys)

        # 2. Velocity Calculation (pixels/sec)
        dt = np.diff(timestamps)
        # Prevent division by zero or negative time jumps
        dt = np.where(dt <= 0, 1e-4, dt)
        dx = np.diff(xs)
        dy = np.diff(ys)
        displacements = np.hypot(dx, dy)
        velocities = displacements / dt

        # Midpoint timestamps for velocities
        vel_times = timestamps[:-1] + (dt / 2.0)

        # 3. Acceleration Calculation (pixels/sec^2)
        if len(velocities) >= 2:
            dv = np.diff(velocities)
            dt_vel = np.diff(vel_times)
            dt_vel = np.where(dt_vel <= 0, 1e-4, dt_vel)
            accelerations = dv / dt_vel
            acc_times = vel_times[:-1] + (dt_vel / 2.0)
        else:
            accelerations = np.array([0.0])
            acc_times = np.array([timestamps[0]])

        # 4. Trend Analysis
        velocity_trend = self._determine_velocity_trend(velocities)
        acceleration_trend = self._determine_acceleration_trend(accelerations)

        # 5. Sudden Motion Change Detection
        sudden_events = []
        sudden_change_detected = False
        for idx, acc in enumerate(accelerations):
            if abs(acc) >= self.sudden_threshold:
                sudden_change_detected = True
                sudden_events.append({
                    "timestamp_seconds": round(float(acc_times[idx]), 3),
                    "acceleration_px_per_sec2": round(float(acc), 2),
                    "nature": "abrupt_deceleration" if acc < 0 else "abrupt_acceleration",
                })

        max_vel = float(np.max(velocities)) if len(velocities) > 0 else 0.0
        max_acc = float(np.max(np.abs(accelerations))) if len(accelerations) > 0 else 0.0

        return {
            "direction": direction,
            "velocity_trend": velocity_trend,
            "acceleration_trend": acceleration_trend,
            "sudden_motion_change": sudden_change_detected,
            "max_velocity_px_per_sec": round(max_vel, 2),
            "max_acceleration_px_per_sec2": round(max_acc, 2),
            "sudden_change_events": sudden_events,
        }

    def detect_interactions(
        self,
        trajectory_manager: TrajectoryManager,
    ) -> List[Dict[str, Any]]:
        """
        Compares trajectories across all vehicle pairs to detect spatio-temporal
        path convergence in the 2D image plane.

        Considers both spatial proximity AND temporal co-occurrence.
        """
        interactions = []
        vehicle_ids = trajectory_manager.vehicle_ids()
        n = len(vehicle_ids)

        if n < 2:
            return interactions

        for i in range(n):
            for j in range(i + 1, n):
                id_a = vehicle_ids[i]
                id_b = vehicle_ids[j]

                pts_a = trajectory_manager.get_points(id_a)
                pts_b = trajectory_manager.get_points(id_b)

                if not pts_a or not pts_b:
                    continue

                convergence = self._check_pair_convergence(id_a, pts_a, id_b, pts_b)
                if convergence:
                    interactions.append(convergence)

        return interactions

    def _check_pair_convergence(
        self,
        id_a: int,
        pts_a: list,
        id_b: list,
        pts_b: list,
    ) -> Optional[Dict[str, Any]]:
        """
        Computes minimum spatio-temporal distance between two vehicles.
        """
        # Index points by closest timestamps
        min_distance = float("inf")
        min_time = 0.0
        min_frame = 0

        # Create lookup table of b points: timestamp -> (frame, x, y)
        b_times = np.array([p.timestamp_seconds for p in pts_b])

        converged_points = []

        for p_a in pts_a:
            t_a = p_a.timestamp_seconds
            # Find closest timestamp in vehicle B within temporal window
            time_diffs = np.abs(b_times - t_a)
            closest_idx = int(np.argmin(time_diffs))

            if time_diffs[closest_idx] <= self.interaction_time_win:
                p_b = pts_b[closest_idx]
                dist = np.hypot(p_a.x - p_b.x, p_a.y - p_b.y)
                converged_points.append((dist, t_a, p_a.frame_number))
                if dist < min_distance:
                    min_distance = dist
                    min_time = t_a
                    min_frame = p_a.frame_number

        if min_distance <= self.interaction_dist_thresh:
            return {
                "vehicle_id_a": id_a,
                "vehicle_id_b": id_b,
                "timestamp_seconds": round(float(min_time), 3),
                "frame_number": min_frame,
                "distance_pixels": round(float(min_distance), 2),
                "interaction_type": "path_convergence",
                "description": (
                    f"Vehicle {id_a} and Vehicle {id_b} trajectories converge to minimum "
                    f"image-plane distance of {min_distance:.1f} px at {min_time:.2f}s."
                ),
            }

        return None

    def _calculate_direction(self, xs: np.ndarray, ys: np.ndarray) -> str:
        """
        Estimates primary compass and planar heading from trajectory endpoints.
        Returns: 'right', 'left', 'up', 'down', or 'stationary'.
        """
        dx = float(xs[-1] - xs[0])
        dy = float(ys[-1] - ys[0])
        total_disp = np.hypot(dx, dy)

        # If vehicle moved less than 10 pixels total, consider stationary
        if total_disp < 10.0:
            return "stationary"

        # Image coordinate system: +x is Right, +y is Down
        if abs(dx) >= abs(dy):
            return "right" if dx > 0 else "left"
        else:
            return "down" if dy > 0 else "up"

    def _determine_velocity_trend(self, velocities: np.ndarray) -> str:
        """
        Determines if velocity is increasing, decreasing, or approximately constant.
        Uses linear regression slope over time to avoid local noise.
        """
        if len(velocities) < 3:
            return "constant"

        indices = np.arange(len(velocities))
        # Compute linear slope
        slope, _ = np.polyfit(indices, velocities, 1)

        if slope > self.vel_eps / len(velocities):
            return "increasing"
        elif slope < -self.vel_eps / len(velocities):
            return "decreasing"
        else:
            return "constant"

    def _determine_acceleration_trend(self, accelerations: np.ndarray) -> str:
        """
        Determines average acceleration trend: 'positive', 'negative', or 'zero'.
        """
        if len(accelerations) == 0:
            return "zero"

        mean_acc = float(np.mean(accelerations))
        if mean_acc > self.acc_eps:
            return "positive"
        elif mean_acc < -self.acc_eps:
            return "negative"
        else:
            return "zero"

    @staticmethod
    def get_limitations() -> List[str]:
        """Returns standard forensic and scientific limitation statements."""
        return list(EVIDENCE_LIMITATIONS)
