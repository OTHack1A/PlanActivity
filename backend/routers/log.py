from fastapi import APIRouter, Depends, Query
from .. import models, schemas
from ..auth import current_account
from ..logging_config import LOG_FILE, get_logger

router = APIRouter(prefix="/api/log", tags=["log"])


def _sanitize(s: str) -> str:
    """Rimuove CR/LF per prevenire log injection (OWASP A03)."""
    return str(s).replace("\r", "").replace("\n", " ").strip()


@router.post("/event", status_code=204)
def log_frontend_event(
    body: schemas.LogEventIn,
    _: models.Account = Depends(current_account),
):
    logger = get_logger()
    action = _sanitize(body.action)
    details_str = (
        " — " + ", ".join(f"{_sanitize(k)}={_sanitize(v)}" for k, v in body.details.items())
        if body.details
        else ""
    )
    logger.info(f"[UI] {action}{details_str}")


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
