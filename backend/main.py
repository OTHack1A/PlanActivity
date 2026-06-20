import traceback
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, account, departments, employees, entries
from .routers import log as log_router
from .logging_config import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = setup_logging()
    Base.metadata.create_all(bind=engine)
    logger.info("Applicazione Pianifica avviata")
    yield
    logger.info("Applicazione Pianifica arrestata")


app = FastAPI(title="Pianifica API", lifespan=lifespan)

# CORS solo per sviluppo (Vite gira su :5173)
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


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    from .logging_config import get_logger
    get_logger().warning(
        f"Validazione fallita: {request.method} {request.url.path} — {exc.errors()}"
    )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    from .logging_config import get_logger
    get_logger().error(
        f"Errore non gestito: {request.method} {request.url.path} — "
        f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
    )
    return JSONResponse(status_code=500, content={"detail": "Errore interno del server"})


# In produzione serve il build del frontend
_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")
