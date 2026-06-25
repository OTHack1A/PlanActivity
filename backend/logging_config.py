"""
Application logging setup.

A single rotating file logger named "pianifica" is shared across the whole app.
Lines use a fixed, human-readable format: [YYYY-MM-DD][HH:MM:SS][LEVEL]: message
The file rotates at 10 MB and keeps 5 backups, so logs never grow unbounded.
"""
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from ._paths import LOG_FILE


class _Fmt(logging.Formatter):
    """Custom formatter producing the project's bracketed date/time/level prefix."""

    def format(self, record: logging.LogRecord) -> str:
        # Use local time derived from the record's creation timestamp.
        dt = datetime.fromtimestamp(record.created)
        return (
            f"[{dt.strftime('%Y-%m-%d')}][{dt.strftime('%H:%M:%S')}]"
            f"[{record.levelname}]: {record.getMessage()}"
        )


def setup_logging() -> logging.Logger:
    """Configure (once) and return the shared 'pianifica' logger.

    Idempotent: if handlers are already attached the existing logger is returned,
    so repeated calls (e.g. from both run.py and the FastAPI lifespan) are safe.
    """
    logger = logging.getLogger("pianifica")
    if logger.handlers:
        return logger  # already configured — don't add duplicate handlers
    logger.setLevel(logging.DEBUG)
    # Rotate at 10 MB, keep 5 old files; LOG_FILE lives in the writable DATA_DIR.
    handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    handler.setFormatter(_Fmt())
    logger.addHandler(handler)
    return logger


def get_logger() -> logging.Logger:
    """Return the shared logger. Assumes setup_logging() has run at startup."""
    return logging.getLogger("pianifica")
