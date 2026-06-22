"""
Pianifica — production launcher.

Used as the PyInstaller entry point: `pyinstaller pianifica.spec`
Also runnable directly: `python run.py`
"""
import asyncio
import multiprocessing
import os
import sys
import threading
import webbrowser
from pathlib import Path

HOST = "127.0.0.1"
PORT = 16853


def _silence_stdio() -> None:
    """In windowed (no-console) mode stdout/stderr are None — redirect to devnull."""
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")


# ---------- autostart Windows registry ----------

def _autostart_enabled() -> bool:
    if not getattr(sys, "frozen", False):
        return False
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
        )
        try:
            winreg.QueryValueEx(key, "Pianifica")
            return True
        except FileNotFoundError:
            return False
        finally:
            winreg.CloseKey(key)
    except Exception:
        return False


def _set_autostart(enable: bool) -> None:
    if not getattr(sys, "frozen", False):
        return
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0, winreg.KEY_SET_VALUE,
        )
        try:
            if enable:
                exe = f'"{sys.executable}"'
                winreg.SetValueEx(key, "Pianifica", 0, winreg.REG_SZ, exe)
            else:
                try:
                    winreg.DeleteValue(key, "Pianifica")
                except FileNotFoundError:
                    pass
        finally:
            winreg.CloseKey(key)
    except Exception:
        pass


# ---------- tray icon ----------

def _load_icon():
    """Return a PIL Image for the tray icon, with fallback to a solid square."""
    from PIL import Image
    paths: list[Path] = []
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            paths.append(Path(meipass) / "logo.ico")
        paths.append(Path(sys.executable).parent / "logo.ico")
    else:
        paths.append(Path(__file__).parent / "logo.ico")
    for p in paths:
        try:
            if p.exists():
                return Image.open(p)
        except Exception:
            pass
    img = Image.new("RGBA", (64, 64), (74, 144, 217, 255))
    return img


def _run_tray(server) -> None:
    """Run the pystray icon on the calling thread (must be the main thread on Windows)."""
    import pystray

    img = _load_icon()

    def on_open(_icon, _item):
        webbrowser.open(f"http://{HOST}:{PORT}")

    def on_toggle_autostart(_icon, _item):
        _set_autostart(not _autostart_enabled())

    def on_exit(_icon, _item):
        server.should_exit = True
        _icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem("Apri Pianifica", on_open, default=True),
        pystray.MenuItem(
            "Avvia all'avvio di Windows",
            on_toggle_autostart,
            checked=lambda _item: _autostart_enabled(),
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Esci", on_exit),
    )

    icon = pystray.Icon("Pianifica", img, "Pianifica", menu)
    icon.run()


# ---------- main ----------

def main() -> None:
    _silence_stdio()

    import uvicorn
    from backend.main import app
    from backend.logging_config import get_logger

    get_logger().info(f"Pianifica in ascolto su http://{HOST}:{PORT}")

    config = uvicorn.Config(app, host=HOST, port=PORT, log_level="warning")
    server = uvicorn.Server(config)

    def _run_server() -> None:
        asyncio.run(server.serve())

    server_thread = threading.Thread(target=_run_server, daemon=True)
    server_thread.start()

    if getattr(sys, "frozen", False):
        # Wait briefly for the server to be ready, then open the browser once.
        import time
        time.sleep(1.5)
        webbrowser.open(f"http://{HOST}:{PORT}")
        # Tray icon runs on the main thread (required on Windows).
        _run_tray(server)
    else:
        # Dev mode: just wait for the server thread (Ctrl-C exits).
        try:
            server_thread.join()
        except KeyboardInterrupt:
            server.should_exit = True


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
