import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv
from ._paths import DATA_DIR

load_dotenv()

DATA_DIR.mkdir(exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'pianifica.db'}")

# Filesystem path of the SQLite DB file (None for non-sqlite backends) — used by
# the startup backup routine. Backups only make sense for a local file DB.
DB_PATH: Path | None = (
    Path(DATABASE_URL[len("sqlite:///"):]) if DATABASE_URL.startswith("sqlite:///") else None
)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
