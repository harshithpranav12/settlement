"""
TRACE AI - Environment & Dependency Verification Script
Run this script to verify that Python, OpenCV, PyTorch, Ultralytics, and NumPy
are properly installed and ready for video processing and vehicle detection.
"""

import sys

def verify():
    print("=" * 60)
    print("TRACE AI - Computer Vision Environment Check")
    print("=" * 60)
    
    # 1. Check Python version
    py_version = sys.version.split()[0]
    print(f"[✓] Python version: {py_version}")
    
    # 2. Check OpenCV
    try:
        import cv2
        print(f"[✓] OpenCV installed: {cv2.__version__}")
    except ImportError as e:
        print(f"[✗] OpenCV failed to import: {e}")
        return False

    # 3. Check NumPy
    try:
        import numpy as np
        print(f"[✓] NumPy installed: {np.__version__}")
    except ImportError as e:
        print(f"[✗] NumPy failed to import: {e}")
        return False

    # 4. Check Matplotlib
    try:
        import matplotlib
        print(f"[✓] Matplotlib installed: {matplotlib.__version__}")
    except ImportError as e:
        print(f"[✗] Matplotlib failed to import: {e}")
        return False

    # 5. Check PyTorch & Device
    try:
        import torch
        cuda_avail = torch.cuda.is_available()
        device_name = torch.cuda.get_device_name(0) if cuda_avail else "CPU (Standard Mode)"
        print(f"[✓] PyTorch installed: {torch.__version__}")
        print(f"    Compute device: {device_name}")
    except ImportError as e:
        print(f"[✗] PyTorch failed to import: {e}")
        return False

    # 6. Check Ultralytics YOLO
    try:
        import ultralytics
        print(f"[✓] Ultralytics installed: {ultralytics.__version__}")
    except ImportError as e:
        print(f"[✗] Ultralytics failed to import: {e}")
        return False

    print("=" * 60)
    print("ALL DEPENDENCIES VERIFIED SUCCESSFULLY! READY FOR STAGE 3.")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = verify()
    sys.exit(0 if success else 1)
