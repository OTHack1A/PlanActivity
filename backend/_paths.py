"""
Central path resolver for both development and frozen (PyInstaller) execution.

In dev: RUNTIME_ROOT == repo root (parent of backend/).
Frozen: RUNTIME_ROOT == directory containing pianifica.exe
        (persistent data lives next to the exe, NOT in _MEIPASS temp dir).
"""
import sys
from pathlib import Path


def _runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).parent.parent


RUNTIME_ROOT = _runtime_root()
DATA_DIR = RUNTIME_ROOT / "data"
LOG_FILE = RUNTIME_ROOT / "pianifica.log"
