"""
Central path resolver for both development and frozen (PyInstaller) execution.

In dev: RUNTIME_ROOT == repo root (parent of backend/).
Frozen: RUNTIME_ROOT == directory containing pianifica.exe
        (persistent data lives next to the exe if writable, otherwise in %LOCALAPPDATA%/Pianifica).
"""
import os
import sys
from pathlib import Path


def _runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).parent.parent


def _data_dir() -> Path:
    """Return a guaranteed-writable data directory."""
    if not getattr(sys, "frozen", False):
        d = _runtime_root() / "data"
        d.mkdir(parents=True, exist_ok=True)
        return d

    # Frozen: prefer next to the exe for portability, fall back to LOCALAPPDATA.
    local = _runtime_root() / "data"
    try:
        local.mkdir(parents=True, exist_ok=True)
        probe = local / ".writable"
        probe.write_text("1", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return local
    except OSError:
        pass

    appdata = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or ""
    fallback = Path(appdata) / "Pianifica" / "data" if appdata else local
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


RUNTIME_ROOT = _runtime_root()
DATA_DIR = _data_dir()
LOG_FILE = RUNTIME_ROOT / "pianifica.log"
