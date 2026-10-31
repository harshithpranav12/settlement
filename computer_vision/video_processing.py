"""
TRACE AI - Video Processing Module
Handles video ingestion, frame extraction, metadata calculation,
and frame streaming using OpenCV.
"""

from pathlib import Path
from typing import Generator, Tuple, Dict, Any
import cv2


class VideoReader:
    """
    Reads video files using OpenCV, extracts video metadata,
    and yields frames sequentially with calculated timestamps.
    """

    def __init__(self, video_path: str | Path):
        self.video_path = Path(video_path)
        if not self.video_path.exists():
            raise FileNotFoundError(f"Video file not found at: {self.video_path}")
        
        self.cap = cv2.VideoCapture(str(self.video_path))
        if not self.cap.isOpened():
            raise ValueError(f"Could not open video file: {self.video_path}. Verify format and codec.")
        
        self.metadata = self._extract_metadata()

    def _extract_metadata(self) -> Dict[str, Any]:
        """
        Extracts key video metadata including FPS, frame count,
        resolution, and total duration in seconds.
        """
        fps = self.cap.get(cv2.CAP_PROP_FPS)
        # Fallback to standard 30 FPS if metadata is missing or corrupted (common in some web streams)
        if fps <= 0 or fps is None:
            fps = 30.0
        
        total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Check for unreadable / 0-frame videos
        if total_frames <= 0 or width <= 0 or height <= 0:
            ret, test_frame = self.cap.read()
            if not ret or test_frame is None:
                raise ValueError(
                    f"Video file '{self.video_path.name}' is empty, corrupted, or has no readable frames."
                )
            # Reset back to beginning
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            if width <= 0:
                width = test_frame.shape[1]
            if height <= 0:
                height = test_frame.shape[0]
        
        # Calculate duration in seconds
        duration_seconds = (total_frames / fps) if fps > 0 and total_frames > 0 else 0.0

        return {
            "fps": round(float(fps), 2),
            "total_frames": total_frames,
            "duration_seconds": round(float(duration_seconds), 2),
            "resolution": {
                "width": width,
                "height": height
            }
        }

    def get_metadata(self) -> Dict[str, Any]:
        """Returns the extracted video metadata dictionary."""
        return self.metadata

    def frames(self) -> Generator[Tuple[int, float, Any], None, None]:
        """
        Generator that reads frames one by one from the video stream.
        Memory efficient: does not load the entire video into RAM.

        Yields:
            Tuple of:
                - frame_number (int): 0-indexed frame count
                - timestamp_seconds (float): Calculated elapsed time in seconds
                - frame (numpy.ndarray): BGR image frame from OpenCV
        """
        # Reset position to the start
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        fps = self.metadata["fps"]
        frame_number = 0

        while True:
            ret, frame = self.cap.read()
            if not ret or frame is None:
                break
            
            timestamp_seconds = round(frame_number / fps, 4)
            yield frame_number, timestamp_seconds, frame
            frame_number += 1

    def release(self) -> None:
        """Closes the video capture stream and releases system resources."""
        if self.cap is not None and self.cap.isOpened():
            self.cap.release()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()
