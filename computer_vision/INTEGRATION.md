# TRACE AI — Computer Vision & Physics Module: Backend Integration Guide

This document is prepared for the **FastAPI Backend Engineer** to seamlessly integrate the **Computer Vision & Physics Reasoning module** into the TRACE AI backend service.

---

## 1. Quick Integration Overview

The Computer Vision module is self-contained and exposes a single deterministic, synchronous Python function:

```python
from computer_vision import process_video

# Or explicitly from the entry point:
from computer_vision.main import process_video
```

No external microservices, background brokers, or hardcoded ports are required. The module directly ingests an MP4/video file and returns a structured dictionary while saving visual and JSON artifacts.

---

## 2. Public API Specification

### Function Signature

```python
def process_video(
    video_path: str | Path,
    output_dir: Optional[str | Path] = None,
    export_annotated_video: bool = True
) -> Dict[str, Any]:
```

### Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `video_path` | `str` or `Path` | **Yes** | — | Absolute or relative path to the uploaded video file. |
| `output_dir` | `str` or `Path` | No | `computer_vision/outputs` | Target directory where output artifacts will be written. |
| `export_annotated_video` | `bool` | No | `True` | Set to `False` if your backend needs faster processing without rendering the annotated MP4 video. |

### Return Value

Returns a Python `dict` containing the full forensic timeline analysis, detections, motion metrics, and file paths to all generated artifacts.

### Exceptions & Error Handling

| Exception | Condition | Recommended Backend HTTP Status |
| :--- | :--- | :--- |
| `FileNotFoundError` | The provided `video_path` does not exist on disk. | `404 Not Found` |
| `ValueError` | The video file is corrupt, empty (0 frames), or uses an unsupported video codec. | `422 Unprocessable Entity` |
| `RuntimeError` | Severe OpenCV or tracking hardware fault. | `500 Internal Server Error` |

---

## 3. Recommended FastAPI Integration Pattern

In your FastAPI router (e.g. `backend/routers/analysis.py`), you can wrap `process_video` in a background task or run it in a threadpool so it does not block the async event loop:

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.concurrency import run_in_threadpool
import shutil
from pathlib import Path
from computer_vision import process_video

router = APIRouter(prefix="/api/v1", tags=["Forensic Analysis"])

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

@router.post("/analyze-video")
async def analyze_video_endpoint(file: UploadFile = File(...)):
    # 1. Save uploaded file to disk
    temp_video_path = UPLOAD_DIR / file.filename
    with open(temp_video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 2. Execute CV pipeline in a separate worker thread (CPU-bound)
        result = await run_in_threadpool(
            process_video,
            video_path=temp_video_path,
            output_dir=OUTPUT_DIR,
            export_annotated_video=True
        )
        return {
            "status": "success",
            "data": result
        }

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis pipeline error: {str(e)}")
```

---

## 4. Standardized JSON Schema

The output dictionary fulfills **both** the agreed Base Schema and the Extended Forensic Schema:

### Schema Field Definitions

* **Base Schema (Agreed)**:
  * `source_id` (*string*): Video filename stem or identifier.
  * `video_fps` (*float*): Effective frame rate.
  * `frame_width` (*int*): Pixel width of video frames.
  * `frame_height` (*int*): Pixel height of video frames.
  * `detections` (*list[dict]*): Chronological flat list of all vehicle bounding boxes across all frames.
* **Extended Forensic Reconstruction Schema**:
  * `video_id` (*string*): Unique clip identifier.
  * `video_metadata` (*dict*): Resolution, FPS, duration, total frames.
  * `vehicles` (*list[dict]*): Grouped per-vehicle history, motion trends, and 2D image trajectories.
  * `possible_interactions` (*list[dict]*): Spatio-temporal path convergence events between vehicle pairs.
  * `limitations` (*list[string]*): Forensic disclaimers regarding image-plane pixel measurements and calibration requirements.
  * `artifacts` (*dict*): Absolute/relative paths to the saved `.json`, `.mp4`, and `.png` files.

---

## 5. Real Sample JSON Payload

Below is an authentic sample produced by `process_video("computer_vision/sample_videos/car_traffic.mp4")`:

```json
{
  "source_id": "car_traffic",
  "video_fps": 12.5,
  "frame_width": 768,
  "frame_height": 432,
  "detections": [
    {
      "vehicle_id": 8,
      "vehicle_class": "car",
      "frame_number": 204,
      "timestamp_seconds": 16.32,
      "bbox": [320.12, 180.5, 410.6, 255.4],
      "center_x": 365.36,
      "center_y": 217.95,
      "confidence": 0.824
    }
  ],
  "video_id": "car_traffic",
  "video_metadata": {
    "fps": 12.5,
    "total_frames": 377,
    "duration_seconds": 30.16,
    "resolution": {
      "width": 768,
      "height": 432
    }
  },
  "vehicles": [
    {
      "vehicle_id": 8,
      "vehicle_class": "car",
      "detections": [...],
      "motion_analysis": {
        "direction": "down",
        "velocity_trend": "decreasing",
        "acceleration_trend": "negative",
        "sudden_motion_change": true,
        "max_velocity_px_per_sec": 78.4,
        "max_acceleration_px_per_sec2": -284.1,
        "sudden_change_events": [
          {
            "timestamp_seconds": 17.2,
            "acceleration_px_per_sec2": -284.1,
            "nature": "abrupt_deceleration"
          }
        ]
      },
      "trajectory": [
        {"timestamp_seconds": 16.32, "x": 365.36, "y": 217.95},
        {"timestamp_seconds": 16.40, "x": 366.10, "y": 222.40}
      ]
    }
  ],
  "possible_interactions": [
    {
      "vehicle_id_a": 8,
      "vehicle_id_b": 10,
      "timestamp_seconds": 18.4,
      "frame_number": 230,
      "distance_pixels": 1.08,
      "interaction_type": "path_convergence",
      "description": "Vehicle 8 and Vehicle 10 trajectories converge to minimum image-plane distance of 1.1 px at 18.40s."
    }
  ],
  "limitations": [
    "All velocities and accelerations are measured strictly in 2D image-plane pixels per second (px/s) and px/s^2.",
    "Image-plane pixel measurements CANNOT be directly converted to real-world metric speed (km/h or mph) without camera calibration, intrinsic/extrinsic parameters, and physical ground distance references.",
    "Camera perspective distortion, tilt angle, lens distortion, and distance from camera significantly affect pixel displacement rates.",
    "Trajectory convergence and sudden motion changes represent possible interactions in the 2D video plane, NOT confirmed physical collisions or liability determinations.",
    "Occlusions, lighting changes, camera motion, and tracking ID switches may cause temporary tracking gaps or ID reassignment."
  ],
  "artifacts": {
    "json_path": "outputs/car_traffic_analysis.json",
    "trajectory_plot_path": "outputs/car_traffic_trajectories.png",
    "annotated_video_path": "outputs/car_traffic_annotated.mp4"
  }
}
```

---

## 6. Mock Data for Backend Testing Without CV Running

To test your backend routes and frontend timeline UI before running heavy neural net inference, you can load the static sample directly from:

[`computer_vision/outputs/example_analysis.json`](file:///c:/Users/prana/TRACE-AI/computer_vision/outputs/example_analysis.json)
