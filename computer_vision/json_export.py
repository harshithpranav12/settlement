"""
TRACE AI - JSON Export Module
Compiles video metadata, tracked vehicle histories, motion analysis,
trajectory sequences, possible interaction events, and forensic limitations
into the standardized TRACE AI JSON output schema.
"""

import sys
import json
from pathlib import Path
from typing import Dict, List, Any

# Ensure project root in sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))


class JSONExporter:
    """
    Constructs and exports the structured JSON analysis artifact for the
    FastAPI backend and React frontend.
    """

    def __init__(self, output_dir: Path | str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def build_payload(
        self,
        video_id: str,
        video_metadata: Dict[str, Any],
        vehicles_data: List[Dict[str, Any]],
        possible_interactions: List[Dict[str, Any]],
        limitations: List[str],
    ) -> Dict[str, Any]:
        """
        Constructs the dictionary matching both the agreed base schema:
        (source_id, video_fps, frame_width, frame_height, detections)
        AND the extended forensic schema:
        (video_id, video_metadata, vehicles, possible_interactions, limitations).
        """
        # Compile flat list of all detections sorted by frame number for base schema
        flat_detections = []
        for v in vehicles_data:
            for det in v.get("detections", []):
                flat_detections.append(det)
        flat_detections.sort(key=lambda d: (d.get("frame_number", 0), d.get("vehicle_id", 0)))

        resolution = video_metadata.get("resolution", {})
        fps = video_metadata.get("fps", 30.0)
        width = resolution.get("width", 0)
        height = resolution.get("height", 0)

        return {
            # Agreed Base Schema
            "source_id": video_id,
            "video_fps": fps,
            "frame_width": width,
            "frame_height": height,
            "detections": flat_detections,

            # Extended Forensic Reconstruction Schema
            "video_id": video_id,
            "video_metadata": video_metadata,
            "vehicles": vehicles_data,
            "possible_interactions": possible_interactions,
            "limitations": limitations,
        }

    def save(self, payload: Dict[str, Any], filename: str = None) -> Path:
        """
        Writes payload to disk as formatted JSON.
        """
        video_id = payload.get("video_id", "analysis")
        out_name = filename or f"{video_id}_analysis.json"
        target_path = self.output_dir / out_name

        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        return target_path
