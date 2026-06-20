from fastapi import APIRouter, Depends, Query
from .. import models, schemas
from ..auth import current_account
from ..logging_config import LOG_FILE, get_logger

router = APIRouter(prefix="/api/log", tags=["log"])

_MAX_ACTION_LEN = 300


def _sanitize(s: str) -> str:
    """Rimuove CR/LF (log injection, OWASP A03) e tronca la stringa."""
    return str(s).replace("\r", "").replace("\n", " ").strip()[:_MAX_ACTION_LEN]


@router.post("/event", status_code=204)
def log_frontend_event(
    body: schemas.LogEventIn,
    _: models.Account = Depends(current_account),
):
    """Evento UI autenticato (richiede JWT)."""
    action = _sanitize(body.action)
    details_str = (
        " — " + ", ".join(f"{_sanitize(k)}={_sanitize(str(v))}" for k, v in body.details.items())
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
    if not LOG_FILE.exists():
        return {"lines": []}
    with open(LOG_FILE, encoding="utf-8") as f:
        all_lines = f.readlines()
    return {"lines": [ln.rstrip() for ln in all_lines[-lines:]]}
