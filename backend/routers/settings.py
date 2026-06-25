"""Global application settings, persisted as key/value rows in app_settings."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import current_account
from ..logging_config import get_logger

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_bool(db: Session, key: str) -> bool:
    """Read a boolean setting; missing rows default to False."""
    row = db.get(models.AppSettings, key)
    return row is not None and row.value.lower() in ("1", "true", "yes")


def _set_bool(db: Session, key: str, value: bool) -> None:
    """Upsert a boolean setting as the string 'true'/'false'."""
    row = db.get(models.AppSettings, key)
    if row is None:
        # First time this key is set — create the row.
        row = models.AppSettings(key=key, value="")
        db.add(row)
    row.value = "true" if value else "false"
    db.commit()


@router.get("", response_model=schemas.SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    """Return all global settings the frontend needs."""
    return {"saturday_half_day": _get_bool(db, "saturday_half_day")}


@router.patch("")
def patch_settings(
    body: schemas.SettingsPatch,
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    """Update only the settings present in the request body (partial update)."""
    if body.saturday_half_day is not None:
        _set_bool(db, "saturday_half_day", body.saturday_half_day)
        get_logger().info(f"Impostazione 'saturday_half_day' → {body.saturday_half_day}")
    return {"ok": True}
