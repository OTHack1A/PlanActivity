"""
Pianifica — production launcher.

Used as the PyInstaller entry point: `pyinstaller pianifica.spec`
Also runnable directly: `python run.py`
"""
import multiprocessing
import sys


def main() -> None:
    import uvicorn
    from backend.main import app

    host = "127.0.0.1"
    port = 8000

    print(f"")
    print(f"  Pianifica  —  http://{host}:{port}")
    print(f"  Premi Ctrl+C per uscire.")
    print(f"")

    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    # freeze_support() is required for --onefile multiprocessing on Windows
    multiprocessing.freeze_support()
    main()
