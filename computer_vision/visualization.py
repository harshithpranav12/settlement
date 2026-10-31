"""
TRACE AI - Visualization Module
Renders annotated video with bounding boxes, tracking IDs, trajectory trails,
and sudden motion change alerts. Also generates Matplotlib trajectory plots.
"""

import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
import cv2
import numpy as np

# Use Agg non-interactive backend for headless environments & servers
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Ensure project root in sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

try:
    from computer_vision.trajectory import TrajectoryManager
except ModuleNotFoundError:
    from trajectory import TrajectoryManager


# Distinct color palette (BGR format for OpenCV)
PALETTE_BGR = [
    (255, 105, 65),   # Royal Blue
    (46, 204, 113),   # Emerald Green
    (231, 76, 60),    # Coral Red
    (155, 89, 182),   # Amethyst Purple
    (241, 196, 15),   # Sun Yellow
    (230, 126, 34),   # Carrot Orange
    (52, 152, 219),   # Sky Blue
    (26, 188, 156),   # Turquoise
]


def get_color_for_id(vehicle_id: int) -> Tuple[int, int, int]:
    """Returns a deterministic BGR color for a given vehicle ID."""
    return PALETTE_BGR[int(vehicle_id) % len(PALETTE_BGR)]


class Visualizer:
    """
    Handles drawing visual overlays on frames, writing annotated video,
    and rendering multi-vehicle trajectory plots.
    """

    def __init__(self, output_dir: Path | str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def draw_frame_annotations(
        self,
        frame: np.ndarray,
        frame_number: int,
        timestamp_seconds: float,
        tracked_vehicles: List[Dict[str, Any]],
        trajectory_manager: TrajectoryManager,
        sudden_change_vehicle_ids: Optional[set] = None,
    ) -> np.ndarray:
        """
        Draws bounding boxes, IDs, trajectory trails, and status banners on a frame.
        """
        annotated = frame.copy()
        sudden_change_ids = sudden_change_vehicle_ids or set()

        # 1. Draw historical trajectory trails for active vehicles
        for v in tracked_vehicles:
            vid = v["vehicle_id"]
            pts = trajectory_manager.get_points(vid)
            if len(pts) >= 2:
                color = get_color_for_id(vid)
                # Take last 30 points for a smooth trailing path
                recent_pts = pts[-30:]
                for i in range(1, len(recent_pts)):
                    p1 = (int(recent_pts[i - 1].x), int(recent_pts[i - 1].y))
                    p2 = (int(recent_pts[i].x), int(recent_pts[i].y))
                    cv2.line(annotated, p1, p2, color, thickness=2, lineType=cv2.LINE_AA)

        # 2. Draw bounding boxes and labels
        for v in tracked_vehicles:
            vid = v["vehicle_id"]
            vclass = v["vehicle_class"]
            conf = v["confidence"]
            x1, y1, x2, y2 = [int(coord) for coord in v["bbox"]]
            color = get_color_for_id(vid)

            # Highlight bounding box if vehicle triggered a sudden motion change
            box_thickness = 3 if vid in sudden_change_ids else 2
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness=box_thickness)

            # Draw center point
            cx, cy = int(v["center_x"]), int(v["center_y"])
            cv2.circle(annotated, (cx, cy), radius=4, color=(0, 0, 255), thickness=-1)

            # Build label
            label = f"ID {vid} | {vclass} ({conf:.2f})"
            if vid in sudden_change_ids:
                label += " [MOTION ALERT]"

            # Label badge background
            (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            badge_y1 = max(0, y1 - 20)
            cv2.rectangle(annotated, (x1, badge_y1), (x1 + w + 6, badge_y1 + h + 6), color, -1)
            cv2.putText(
                annotated,
                label,
                (x1 + 3, badge_y1 + h + 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

        # 3. Top info overlay (Timestamp & Frame)
        info_banner = f"TRACE AI | Time: {timestamp_seconds:.2f}s | Frame: {frame_number}"
        cv2.rectangle(annotated, (10, 10), (380, 42), (20, 20, 20), -1)
        cv2.putText(
            annotated,
            info_banner,
            (18, 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

        return annotated

    def save_trajectory_plot(
        self,
        trajectory_manager: TrajectoryManager,
        video_id: str,
        video_resolution: Tuple[int, int] = (1920, 1080),
        interactions: Optional[List[Dict[str, Any]]] = None,
    ) -> Path:
        """
        Generates a 2D trajectory plot for all tracked vehicles and saves as PNG.
        Inverts Y axis to match image-plane coordinate orientation.
        """
        width, height = video_resolution
        fig, ax = plt.subplots(figsize=(10, 6), dpi=150)
        ax.set_facecolor("#1e1e24")
        fig.patch.set_facecolor("#121214")

        vehicle_ids = trajectory_manager.vehicle_ids()

        for vid in vehicle_ids:
            ts, xs, ys = trajectory_manager.get_arrays(vid, smoothed=True)
            if len(xs) < 2:
                continue

            # Convert BGR palette to RGB 0-1 for matplotlib
            bgr = get_color_for_id(vid)
            rgb = (bgr[2] / 255.0, bgr[1] / 255.0, bgr[0] / 255.0)

            # Plot line path
            ax.plot(xs, ys, label=f"Vehicle {vid}", color=rgb, linewidth=2.2, alpha=0.9)
            # Mark start point
            ax.scatter(xs[0], ys[0], color=rgb, marker="o", s=40, edgecolors="white", zorder=4)
            # Mark end point
            ax.scatter(xs[-1], ys[-1], color=rgb, marker="s", s=50, edgecolors="white", zorder=4)

        # Mark convergence / interaction points
        if interactions:
            for inter in interactions:
                # Find point coordinates
                vid_a = inter.get("vehicle_id_a")
                pts_a = trajectory_manager.get_points(vid_a)
                if pts_a:
                    inter_frame = inter.get("frame_number", 0)
                    matching = [p for p in pts_a if p.frame_number == inter_frame]
                    if matching:
                        ax.scatter(
                            matching[0].x,
                            matching[0].y,
                            color="#ff3344",
                            marker="X",
                            s=140,
                            edgecolors="yellow",
                            linewidth=1.5,
                            label="Convergence Point",
                            zorder=5,
                        )

        # Formatting
        ax.set_xlim(0, width)
        ax.set_ylim(height, 0)  # Inverted Y for image space
        ax.set_xlabel("X Coordinate (Image Pixels)", color="#cccccc", fontsize=10)
        ax.set_ylabel("Y Coordinate (Image Pixels)", color="#cccccc", fontsize=10)
        ax.set_title(f"TRACE AI - Vehicle Trajectory Reconstruction ({video_id})", color="white", fontsize=12, pad=12)
        ax.tick_params(colors="#aaaaaa", labelsize=8)
        ax.grid(color="#33333d", linestyle="--", linewidth=0.6, alpha=0.7)

        # Handle legend (prevent duplicate entries)
        handles, labels = ax.get_legend_handles_labels()
        by_label = dict(zip(labels, handles))
        if by_label:
            ax.legend(
                by_label.values(),
                by_label.keys(),
                loc="upper right",
                facecolor="#25252b",
                edgecolor="#44444f",
                labelcolor="white",
                fontsize=8,
            )

        plt.tight_layout()
        plot_path = self.output_dir / f"{video_id}_trajectories.png"
        fig.savefig(str(plot_path))
        plt.close(fig)

        return plot_path
