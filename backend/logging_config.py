import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_FILE = Path(__file__).parent.parent / "pianifica.log"


class _Fmt(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        dt = datetime.fromtimestamp(record.created)
        return (
            f"[{dt.strftime('%Y-%m-%d')}][{dt.strftime('%H:%M:%S')}]"
            f"[{record.levelname}]: {record.getMessage()}"
        )


def setup_logging() -> logging.Logger:
    logger = logging.getLogger("pianifica")
    if logger.handlers:
        return logger
    logger.setLevel(logging.DEBUG)
    handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    handler.setFormatter(_Fmt())
    logger.addHandler(handler)
    return logger


def get_logger() -> logging.Logger:
    return logging.getLogger("pianifica")
