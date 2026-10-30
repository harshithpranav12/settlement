# TRACE AI — Computer Vision & Physics Reasoning Module

AI-powered vehicle detection, multi-object tracking, trajectory extraction, and physics-based motion reasoning for road accident timeline reconstruction.

---

## 1. Module Overview & Project Structure

All computer vision and physics reasoning code resides inside `computer_vision/`:

```
computer_vision/
│
├── config.py             # Centralized settings (YOLO model, target vehicle classes, thresholds, disclaimers)
├── video_processing.py   # OpenCV video reading, metadata extraction, frame generator
├── detection.py          # Pretrained YOLOv8 vehicle detection (car, motorcycle, bus, truck)
├── tracking.py           # ByteTrack integration for persistent vehicle ID tracking
├── trajectory.py         # Temporal coordinate collection and path management
├── physics_engine.py     # Direction, pixel velocity, acceleration, sudden change & convergence analysis
├── visualization.py      # Video annotation (bounding boxes, trajectories) & Matplotlib plots
├── json_export.py        # Structured JSON output formatted for backend integration
├── main.py               # Main CLI and callable `process_video` API function
├── verify_env.py         # Verification script to test Python dependencies
├── requirements.txt      # Pinned, tested dependencies for CPU and GPU
├── README.md             # This setup and user guide
├── INTEGRATION.md        # Comprehensive integration guide for the FastAPI backend
│
├── tests/                # Automated pytest test suite (unit & synthetic physics tests)
├── outputs/              # Generated JSON timeline, annotated MP4, and trajectory plots
└── sample_videos/        # Input road accident video files
```

### File Purposes Explained
- **`config.py`**: Holds configuration variables like model weights (`yolov8n.pt`), class filters, physics thresholds (e.g. sudden motion change threshold), and standard scientific limitation disclaimers.
- **`video_processing.py`**: Handles video input via OpenCV, extracts video metadata (FPS, total frames, resolution, duration), and yields frames sequentially.
- **`detection.py`**: Loads the lightweight YOLOv8 model, infers on frames, and filters detections strictly for vehicles (car, motorcycle, bus, truck).
- **`tracking.py`**: Leverages ByteTrack to associate vehicle detections across successive frames and assign persistent IDs.
- **`trajectory.py`**: Stores and smooths the 2D pixel trajectory (center coordinates over time) for each vehicle.
- **`physics_engine.py`**: Calculates image-plane directional headings, pixel velocities (px/s), image-plane accelerations (px/s²), flags sudden decelerations/accelerations, and detects multi-vehicle spatio-temporal convergence.
- **`visualization.py`**: Draws bounding boxes, labels, and motion trails on video frames, outputs annotated MP4 video, and saves matplotlib trajectory graphs.
- **`json_export.py`**: Compiles all detection, tracking, physics data, and limitation disclaimers into the standardized TRACE AI JSON schema.
- **`main.py`**: Exposes the top-level CLI command and the `process_video(video_path, output_dir)` function for the FastAPI backend.

---

## 2. Environment Setup Guide

### Recommended Python Version
- **Python 3.10 or 3.11 (64-bit)** is strongly recommended.
- Python 3.11 provides fast execution, stable OpenCV wheels, and full compatibility with PyTorch and Ultralytics.

---

### Windows (PowerShell) Setup

#### Step 1: Install Python (if not already installed)
You can install Python 3.11 using Windows Package Manager (`winget`):
```powershell
winget install --id Python.Python.3.11 --scope user -e --accept-package-agreements --accept-source-agreements
```
*Note: After installing, restart PowerShell to update your environment PATH.*

#### Step 2: Create a Virtual Environment
From the root of `TRACE-AI`:
```powershell
python -m venv .venv
```

#### Step 3: Enable Script Execution & Activate Environment
If script execution is restricted in PowerShell, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Then activate the virtual environment:
```powershell
.\.venv\Scripts\Activate.ps1
```
*(You will see `(.venv)` in your terminal prompt when activated).*

#### Step 4: Upgrade pip & Install Dependencies
```powershell
python -m pip install --upgrade pip
pip install -r computer_vision/requirements.txt
```

#### Step 5: Verify the Installation
```powershell
python computer_vision/verify_env.py
```

---

### macOS / Linux Setup

#### Step 1: Create and Activate Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
```

#### Step 2: Install Dependencies
```bash
pip install --upgrade pip
pip install -r computer_vision/requirements.txt
```

#### Step 3: Verify the Installation
```bash
python computer_vision/verify_env.py
```

---

## 3. Hardware Support: CPU vs. GPU

- **CPU-Only Execution (Default)**:
  - This module is built using **YOLOv8n (nano)**, which runs efficiently on standard modern CPUs without requiring an NVIDIA GPU.
  - No special drivers or CUDA installations are required.

- **Optional NVIDIA GPU Acceleration**:
  - If you have an NVIDIA GPU and wish to accelerate inference, install the CUDA-enabled build of PyTorch:
    ```bash
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
    ```
  - The module automatically detects CUDA if present; otherwise, it seamlessly falls back to CPU.

---

## 4. How to Run the Module

### Option A: Command Line Interface (CLI)
Place your video inside `computer_vision/sample_videos/input.mp4`, then run:
```powershell
python computer_vision/main.py --video computer_vision/sample_videos/input.mp4
```

### Option B: Backend Integration (FastAPI)
The backend teammate can import and invoke the pipeline directly in Python:
```python
from computer_vision.main import process_video

result = process_video(
    video_path="path/to/accident_clip.mp4",
    output_dir="computer_vision/outputs"
)
# result is a Python dict containing the complete timeline and physics analysis
```

---

## 5. Running the Automated Test Suite

We maintain a comprehensive pytest suite covering video reading, trajectory jitter smoothing, deterministic physics math (velocity, acceleration, sudden changes, path convergence), missing detection handling, and JSON schema formatting:

```powershell
pytest computer_vision/tests/test_cv_module.py -v
```
*(All physics unit tests use deterministic synthetic data and execute in seconds without requiring GPU acceleration).*

---

## 6. Where Outputs Are Saved

All generated assets are stored in `computer_vision/outputs/`:
- **`{video_name}_analysis.json`**: Structured JSON data conforming to both the base schema (`source_id`, `video_fps`, `frame_width`, `frame_height`, `detections`) and extended schema (`vehicles`, `possible_interactions`, `limitations`).
- **`{video_name}_annotated.mp4`**: Annotated video with bounding boxes, tracking IDs, and trajectory trails.
- **`{video_name}_trajectories.png`**: Multi-vehicle 2D trajectory plot.

---

## 7. Backend Integration

See [INTEGRATION.md](INTEGRATION.md) for complete details on integrating `process_video()` with FastAPI endpoints, handling exceptions, and consuming the output schema.

---

## 8. Common Errors & Troubleshooting

1. **`python : The term 'python' is not recognized`**
   - Solution: Install Python 3.11 via `winget` or from [python.org](https://www.python.org/downloads/). Ensure you check "Add python.exe to PATH" during installation.
2. **`Script execution is disabled on this system` (PowerShell error)**
   - Solution: Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` in PowerShell.
3. **`ImportError: DLL load failed while importing cv2`**
   - Solution: Ensure the Windows Media Feature Pack or latest Visual C++ Redistributable is installed.
4. **Out of Memory on Large Videos**
   - Solution: The pipeline processes frames as a streaming generator, so memory usage remains minimal (< 500 MB RAM).
