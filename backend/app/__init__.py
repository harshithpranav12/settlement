"""TRACE AI - Evidence-based road accident timeline reconstruction backend."""

import os
import sys
from pathlib import Path

__version__ = "0.1.0"

# Ensure repository root is in sys.path so computer_vision module can be imported cleanly
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# Ensure writable dirs for matplotlib and ultralytics in sandboxed environments
os.environ.setdefault("MPLCONFIGDIR", "/tmp/mpl")
os.environ.setdefault("YOLO_CONFIG_DIR", "/tmp/yolo")
