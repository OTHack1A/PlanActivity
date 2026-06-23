"""
Pianifica — production launcher.

Entry point for PyInstaller (pyinstaller pianifica.spec) and direct run (python run.py).
The app runs as a background process: uvicorn serves the FastAPI+React app on all network
interfaces so every device on the local network can reach it.
To stop: Task Manager → pianifica.exe → End Task.
"""
import asyncio
import multiprocessing
import os
import socket
import sys
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path

import uvicorn

from backend.main import app
from backend.logging_config import setup_logging, get_logger

HOST = "0.0.0.0"   # listen on all interfaces — reachable from the local network
PORT = 16853


def _lan_ip() -> str:
    """Return the LAN IP of this machine (best-guess via UDP probe, no traffic sent)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "unknown"


def _redirect_null_streams() -> None:
    """Windowed exe (console=False) sets stdout/stderr to None — redirect to devnull."""
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")


def _emergency_log(message: str) -> None:
    """Write to a plain log file when the logging system may not be set up yet."""
    try:
        if getattr(sys, "frozen", False):
            log_path = Path(sys.executable).parent / "pianifica.log"
        else:
            log_path = Path(__file__).parent / "pianifica.log"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now():%Y-%m-%d %H:%M:%S}][ERROR]: {message}\n")
    except Exception:
        pass


def main() -> None:
    _redirect_null_streams()

    try:
        setup_logging()
        logger = get_logger()
        lan = _lan_ip()
        logger.info(
            f"Pianifica starting — "
            f"local: http://127.0.0.1:{PORT}  "
            f"network: http://{lan}:{PORT}"
        )

        config = uvicorn.Config(
            app,
            host=HOST,
            port=PORT,
            log_level="warning",
        )
        server = uvicorn.Server(config)

        def _run_server() -> None:
            try:
                asyncio.run(server.serve())
            except Exception as exc:
                msg = f"Uvicorn server crashed: {exc}"
                try:
                    get_logger().error(msg)
                except Exception:
                    _emergency_log(msg)

        # Non-daemon thread: keeps the process alive after main() returns (frozen mode).
        server_thread = threading.Thread(
            target=_run_server,
            daemon=False,
            name="uvicorn-server",
        )
        server_thread.start()

        if getattr(sys, "frozen", False):
            # Give uvicorn a moment to bind the port, then open the browser once.
            time.sleep(1.5)
            try:
                webbrowser.open(f"http://127.0.0.1:{PORT}")
            except Exception as exc:
                logger.warning(f"Could not open browser: {exc}")
            # main() returns here; the non-daemon server_thread keeps the process alive.
        else:
            # Dev mode: block until the server stops (Ctrl-C exits cleanly).
            try:
                server_thread.join()
            except KeyboardInterrupt:
                logger.info("Shutdown requested (KeyboardInterrupt)")
                server.should_exit = True
                server_thread.join(timeout=10)

    except OSError as exc:
        if "address already in use" in str(exc).lower() or getattr(exc, "errno", 0) in (98, 10048):
            msg = (
                f"Port {PORT} is already in use. "
                "Another instance of Pianifica may be running. "
                "Check Task Manager and close the existing process."
            )
            _emergency_log(msg)
            try:
                get_logger().error(msg)
            except Exception:
                pass
        else:
            import traceback
            _emergency_log(traceback.format_exc())
    except Exception:
        import traceback
        tb = traceback.format_exc()
        _emergency_log(tb)
        try:
            get_logger().error(f"Fatal startup error:\n{tb}")
        except Exception:
            pass


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
