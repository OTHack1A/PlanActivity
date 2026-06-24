"""
Automatic SQLite database backup.

A consistent copy of the database is taken at every startup, BEFORE any schema
migration runs, so a faulty migration or corruption can always be rolled back by
copying a backup file from data/backups/ over data/pianifica.db.

Design goals:
- Robust: never raises. Any failure is logged and the app keeps running.
- Consistent: uses the SQLite online-backup API (handles open connections /
  WAL correctly) instead of a raw file copy.
- Self-pruning: keeps only the most recent `keep` backups.
"""
import sqlite3
from datetime import datetime
from pathlib import Path

from .logging_config import get_logger

DEFAULT_KEEP = 10
BACKUP_DIRNAME = "backups"
BACKUP_PREFIX = "pianifica-"
BACKUP_SUFFIX = ".db"


def _prune(backups_dir: Path, keep: int) -> int:
    """Delete the oldest backups, keeping the `keep` most recent. Returns removed count."""
    backups = sorted(backups_dir.glob(f"{BACKUP_PREFIX}*{BACKUP_SUFFIX}"))
    removed = 0
    for old in backups[: max(0, len(backups) - keep)]:
        try:
            old.unlink()
            removed += 1
        except OSError:
            pass  # locked / already gone — ignore, this is best-effort
    return removed


def backup_database(db_path: Path, keep: int = DEFAULT_KEEP) -> Path | None:
    """Create a timestamped, consistent copy of `db_path` in <db_dir>/backups/.

    Returns the backup path on success, or None if skipped/failed. Never raises.
    """
    logger = get_logger()
    try:
        if not db_path.exists() or db_path.stat().st_size == 0:
            return None  # nothing to back up yet (first run)

        backups_dir = db_path.parent / BACKUP_DIRNAME
        backups_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        dest = backups_dir / f"{BACKUP_PREFIX}{ts}{BACKUP_SUFFIX}"

        # Avoid clobbering if two starts happen within the same second.
        if dest.exists():
            dest = backups_dir / f"{BACKUP_PREFIX}{ts}-{int(datetime.now().microsecond):06d}{BACKUP_SUFFIX}"

        src = sqlite3.connect(str(db_path))
        try:
            dst = sqlite3.connect(str(dest))
            try:
                with dst:
                    src.backup(dst)
            finally:
                dst.close()
        finally:
            src.close()

        removed = _prune(backups_dir, keep)
        msg = f"Backup database creato: {dest.name}"
        if removed:
            msg += f" (rimossi {removed} backup obsoleti, mantenuti ultimi {keep})"
        logger.info(msg)
        return dest
    except Exception as exc:  # never let a backup failure break startup
        try:
            logger.error(f"Backup database fallito (l'applicazione continua): {exc}")
        except Exception:
            pass
        return None
