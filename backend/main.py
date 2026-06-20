from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, account, departments, employees, entries


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crea le tabelle se non esistono (sicuro: non tocca tabelle già presenti)
    Base.metadata.create_all(bind=engine)
    yield


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

# In produzione serve il build del frontend
_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")
