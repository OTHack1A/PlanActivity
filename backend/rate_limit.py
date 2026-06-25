"""
Rate limiting in-memory per endpoint di login.
Dopo MAX_ATTEMPTS tentativi falliti sullo stesso username,
l'accesso viene bloccato per LOCKOUT_SECONDS secondi.
"""
import threading
from datetime import datetime, timedelta

MAX_ATTEMPTS = 3        # failed logins allowed before a lockout kicks in
LOCKOUT_SECONDS = 180   # lockout duration: 3 minutes

# A single process-wide lock guards the shared state dict. The state is in-memory
# only: it resets on restart, which is acceptable for a single-server desktop app.
_lock = threading.Lock()
_state: dict[str, dict] = {}  # {username_lower: {count, locked_until}}


def check_lockout(username: str) -> int:
    """Return the seconds of lockout still remaining for `username` (0 if free)."""
    key = username.lower()
    with _lock:
        entry = _state.get(key)
        if not entry or not entry.get("locked_until"):
            return 0
        remaining = (entry["locked_until"] - datetime.utcnow()).total_seconds()
        if remaining <= 0:
            # Lockout window elapsed — clear the entry so the user can retry.
            del _state[key]
            return 0
        return int(remaining) + 1  # round up so callers never under-report the wait


def record_failure(username: str) -> int:
    """Record a failed attempt. Return lockout seconds if now locked, else 0."""
    key = username.lower()
    with _lock:
        entry = _state.setdefault(key, {"count": 0, "locked_until": None})
        # Already locked: report the remaining time without extending it.
        if entry.get("locked_until"):
            remaining = (entry["locked_until"] - datetime.utcnow()).total_seconds()
            return max(0, int(remaining) + 1)
        entry["count"] += 1
        # Threshold reached — start the lockout window.
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
