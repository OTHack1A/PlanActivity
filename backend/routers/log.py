"""
Logging endpoints.

The frontend forwards UI events here so user actions appear in the same log file
as backend events. The log reader (GET /api/log) powers the in-app log viewer.
All user-supplied strings are sanitised to prevent log-injection (OWASP A03).
"""
from fastapi import APIRouter, Depends, Query
from .. import models, schemas
from ..auth import current_account
from ..logging_config import LOG_FILE, get_logger

router = APIRouter(prefix="/api/log", tags=["log"])

_MAX_ACTION_LEN = 300  # cap UI-supplied strings so a single line can't bloat the log


def _sanitize(s: str) -> str:
    """Strip CR/LF (anti log-injection, OWASP A03) and truncate to a safe length."""
    return str(s).replace("\r", "").replace("\n", " ").strip()[:_MAX_ACTION_LEN]


@router.post("/event", status_code=204)
def log_frontend_event(
    body: schemas.LogEventIn,
    _: models.Account = Depends(current_account),
):
    """Authenticated UI event (requires JWT). Accepts a ready-made `message` or a
    legacy action+details pair; both are sanitised before being written."""
    if body.message:
        safe = _sanitize(body.message)
        if safe:
            get_logger().info(f"[UI] {safe}")
    elif body.action:
        action = _sanitize(body.action)
        details_str = (
            " — " + ", ".join(
                f"{_sanitize(k)}={_sanitize(str(v))}" for k, v in body.details.items()
            )
            if body.details
            else ""
        )
        get_logger().info(f"[UI] {action}{details_str}")


@router.post("/public-event", status_code=204)
def log_public_event(body: schemas.LogPublicEventIn):
    """Evento UI pre-login (senza JWT): username, azienda, errori di form.
    Non registrare mai password o dati sensibili in questo endpoint.
    """
    action = _sanitize(body.action)
    if action:
        get_logger().info(f"[UI-LOGIN] {action}")


@router.get("")
def get_log(
    lines: int = Query(500, ge=1, le=5000),
    _: models.Account = Depends(current_account),
):
    # No log yet (e.g. brand-new install) — return an empty list, not a 404.
    if not LOG_FILE.exists():
        return {"lines": []}
    with open(LOG_FILE, encoding="utf-8") as f:
        all_lines = f.readlines()
    # Return only the tail (most recent `lines` entries) to keep the payload small.
    return {"lines": [ln.rstrip() for ln in all_lines[-lines:]]}
