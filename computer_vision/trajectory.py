"""
TRACE AI - Trajectory Extraction Module
Records, manages, and smooths 2D image-plane vehicle trajectories
over time for physics reasoning and visual plotting.
"""

import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

# Ensure project root in sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

try:
    from computer_vision.config import SMOOTHING_WINDOW
except ModuleNotFoundError:
    from config import SMOOTHING_WINDOW


class TrajectoryPoint:
    """Represents a single spatio-temporal position of a vehicle."""
    def __init__(self, frame_number: int, timestamp_seconds: float, x: float, y: float):
        self.frame_number = frame_number
        self.timestamp_seconds = timestamp_seconds
        self.x = float(x)
        self.y = float(y)

    def to_dict(self) -> Dict[str, Any]:
        """Converts point to the standard JSON schema format."""
        return {
            "frame_number": self.frame_number,
            "timestamp_seconds": round(self.timestamp_seconds, 3),
            "x": round(self.x, 2),
            "y": round(self.y, 2),
        }


class TrajectoryManager:
    """
    Collects temporal trajectories for all tracked vehicles, handles
    spatial jitter smoothing using moving averages, and exports
    trajectories formatted for plotting and JSON output.
    """

    def __init__(self, smoothing_window: int = SMOOTHING_WINDOW):
        self.smoothing_window = max(1, smoothing_window)
        # Maps vehicle_id -> List[TrajectoryPoint]
        self._trajectories: Dict[int, List[TrajectoryPoint]] = {}

    def add_point(
        self,
        vehicle_id: int,
        frame_number: int,
        timestamp_seconds: float,
        x: float,
        y: float,
    ) -> None:
        """
        Adds a new observed 2D center coordinate for a given vehicle ID.
        """
        point = TrajectoryPoint(
            frame_number=frame_number,
            timestamp_seconds=timestamp_seconds,
            x=x,
            y=y
        )
        if vehicle_id not in self._trajectories:
            self._trajectories[vehicle_id] = []
        self._trajectories[vehicle_id].append(point)

    def get_points(self, vehicle_id: int) -> List[TrajectoryPoint]:
        """Returns raw trajectory points recorded for a vehicle ID."""
        return self._trajectories.get(vehicle_id, [])

    def get_trajectory_dict(self, vehicle_id: int, smoothed: bool = True) -> List[Dict[str, float]]:
        """
        Returns the trajectory as a list of dictionaries:
        [{"timestamp_seconds": 1.0, "x": 160.0, "y": 185.0}, ...]
        """
        points = self.get_points(vehicle_id)
        if not points:
            return []

        if not smoothed or len(points) < 3:
            return [pt.to_dict() for pt in points]

        # Extract numpy arrays for smoothing
        timestamps = [pt.timestamp_seconds for pt in points]
        xs = np.array([pt.x for pt in points], dtype=np.float64)
        ys = np.array([pt.y for pt in points], dtype=np.float64)

        smooth_xs = self._apply_moving_average(xs, self.smoothing_window)
        smooth_ys = self._apply_moving_average(ys, self.smoothing_window)

        return [
            {
                "timestamp_seconds": round(t, 3),
                "x": round(float(sx), 2),
                "y": round(float(sy), 2),
            }
            for t, sx, sy in zip(timestamps, smooth_xs, smooth_ys)
        ]

    def get_arrays(self, vehicle_id: int, smoothed: bool = True) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Extracts trajectory as NumPy arrays (timestamps, x_coords, y_coords).
        Ideal for vectorized physics calculations and plotting.
        """
        points = self.get_points(vehicle_id)
        if not points:
            return np.empty(0), np.empty(0), np.empty(0)

        timestamps = np.array([p.timestamp_seconds for p in points], dtype=np.float64)
        xs = np.array([p.x for p in points], dtype=np.float64)
        ys = np.array([p.y for p in points], dtype=np.float64)

        if smoothed and len(points) >= 3:
            xs = self._apply_moving_average(xs, self.smoothing_window)
            ys = self._apply_moving_average(ys, self.smoothing_window)

        return timestamps, xs, ys

    def get_all_trajectories(self, smoothed: bool = True) -> Dict[int, List[Dict[str, float]]]:
        """Returns smoothed trajectories for all tracked vehicles."""
        return {
            vid: self.get_trajectory_dict(vid, smoothed=smoothed)
            for vid in self._trajectories.keys()
        }

    def vehicle_ids(self) -> List[int]:
        """Returns list of tracked vehicle IDs."""
        return list(self._trajectories.keys())

    def clear(self) -> None:
        """Clears all stored trajectory points."""
        self._trajectories.clear()

    @staticmethod
    def _apply_moving_average(data: np.ndarray, window_size: int) -> np.ndarray:
        """
        Applies a moving average filter with reflection/padding at the boundaries
        to preserve the original array length and avoid phase lag.
        """
        if len(data) < window_size or window_size <= 1:
            return data.copy()

        # Symmetric padding to keep length identical without edge distortion
        pad_size = window_size // 2
        padded = np.pad(data, pad_size, mode='edge')
        kernel = np.ones(window_size) / window_size
        smoothed = np.convolve(padded, kernel, mode='valid')

        # Ensure exact match in length
        if len(smoothed) > len(data):
            smoothed = smoothed[:len(data)]
        elif len(smoothed) < len(data):
            diff = len(data) - len(smoothed)
            smoothed = np.pad(smoothed, (0, diff), mode='edge')

        return smoothed
