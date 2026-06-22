import traceback
from contextlib import asynccontextmanager
from pathlib import Path
from sqlalchemy import inspect as sa_inspect, text
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, account, departments, employees, entries
from .routers import log as log_router
from .routers import logo as logo_router
from .routers import settings as settings_router
from .logging_config import setup_logging, get_logger


def _migrate_schema(eng) -> None:
    """Aggiunge colonne mancanti su DB esistenti senza perdere dati (SQLite ADD COLUMN)."""
    logger = get_logger()
    insp = sa_inspect(eng)
    existing_tables = set(insp.get_table_names())
    with eng.connect() as conn:
        if "accounts" in existing_tables:
            cols = {c["name"] for c in insp.get_columns("accounts")}
            if "company" not in cols:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN company VARCHAR DEFAULT ''"))
                conn.commit()
                logger.info("Schema migrato: aggiunta colonna 'company' alla tabella accounts")
        if "app_settings" not in existing_tables:
            conn.execute(text(
                "CREATE TABLE IF NOT EXISTS app_settings (key VARCHAR PRIMARY KEY, value VARCHAR NOT NULL DEFAULT '')"
            ))
            conn.commit()
            logger.info("Schema migrato: creata tabella 'app_settings'")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    Base.metadata.create_all(bind=engine)
    _migrate_schema(engine)
    get_logger().info("Applicazione Pianifica avviata")
    yield
    get_logger().info("Applicazione Pianifica arrestata")


app = FastAPI(title="Pianifica API", lifespan=lifespan, docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(account.router)
app.include_router(departments.router)
app.include_router(employees.router)
app.include_router(entries.router)
app.include_router(log_router.router)
app.include_router(logo_router.router)
app.include_router(settings_router.router)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    # Strip raw 'input' values from the log summary to avoid bloating the log
    # with large payloads; the full detail is still returned to the caller.
    compact = [{k: v for k, v in e.items() if k != "input"} for e in exc.errors()]
    get_logger().warning(
        f"Validazione fallita: {request.method} {request.url.path} — {compact}"
    )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    get_logger().error(
        f"Errore non gestito: {request.method} {request.url.path} — "
        f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
    )
    return JSONResponse(status_code=500, content={"detail": "Errore interno del server"})


# In produzione serve il build del frontend
_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")
