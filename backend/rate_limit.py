"""
Rate limiting in-memory per endpoint di login.
Dopo MAX_ATTEMPTS tentativi falliti sullo stesso username,
l'accesso viene bloccato per LOCKOUT_SECONDS secondi.
"""
import threading
from datetime import datetime, timedelta

MAX_ATTEMPTS = 3
LOCKOUT_SECONDS = 180  # 3 minuti

_lock = threading.Lock()
_state: dict[str, dict] = {}  # {username_lower: {count, locked_until}}


def check_lockout(username: str) -> int:
    """Restituisce i secondi rimanenti di blocco (0 se libero)."""
    key = username.lower()
    with _lock:
        entry = _state.get(key)
        if not entry or not entry.get("locked_until"):
            return 0
        remaining = (entry["locked_until"] - datetime.utcnow()).total_seconds()
        if remaining <= 0:
            del _state[key]
            return 0
        return int(remaining) + 1  # arrotonda per eccesso


def record_failure(username: str) -> int:
    """Registra un tentativo fallito. Restituisce secondi di blocco se ora bloccato, else 0."""
    key = username.lower()
    with _lock:
        entry = _state.setdefault(key, {"count": 0, "locked_until": None})
        if entry.get("locked_until"):
            remaining = (entry["locked_until"] - datetime.utcnow()).total_seconds()
            return max(0, int(remaining) + 1)
        entry["count"] += 1
        if entry["count"] >= MAX_ATTEMPTS:
            entry["locked_until"] = datetime.utcnow() + timedelta(seconds=LOCKOUT_SECONDS)
            return LOCKOUT_SECONDS
        return 0


def get_count(username: str) -> int:
    """Restituisce il numero di tentativi falliti accumulati (0 se nessuno)."""
    key = username.lower()
    with _lock:
        return _state.get(key, {}).get("count", 0)


def reset(username: str) -> None:
    """Azzera i tentativi (chiamato al login riuscito)."""
    key = username.lower()
    with _lock:
        _state.pop(key, None)
