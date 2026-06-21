"""
Pianifica — production launcher.

Used as the PyInstaller entry point: `pyinstaller pianifica.spec`
Also runnable directly: `python run.py`
"""
import multiprocessing
import os
import sys


def _silence_stdio() -> None:
    """In windowed (no-console) mode stdout/stderr are None — redirect to devnull."""
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")


def main() -> None:
    _silence_stdio()

    import uvicorn
    from backend.main import app
    from backend.logging_config import get_logger

    host = "127.0.0.1"
    port = 16853

    get_logger().info(f"Pianifica in ascolto su http://{host}:{port}")
    try:
        uvicorn.run(app, host=host, port=port, log_level="warning")
    except Exception as exc:
        get_logger().critical(f"Errore avvio server: {exc}", exc_info=True)
        raise


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
