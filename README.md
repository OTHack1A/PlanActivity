# Pianifica

Daily activity planner for workshop employees. Manage departments, employees, activities, and absences through a clean multi-view calendar interface.

## Features

- **Multiple views**: Day, Week, Month, Year
- **Departments & employees** with profile photos and overtime hours
- **Daily activities** with planned hours and notes
- **Absences**: vacation, sick leave, leave of absence
- **System log** with built-in read-only viewer in the frontend
- **JWT authentication** with Argon2id password hashing (OWASP parameters)
- **Rate limiting**: 3 failed attempts → 3-minute lockout
- **Auto-generated JWT secret** persisted in `data/.secret` on first run
- **SQLite database** that survives updates (auto-migrated at startup)
- **Multilingual UI**: Italian, English, Spanish, Ukrainian (switchable in the topbar; Cyrillic supported)
- **Customisable logo**: click the logo on the login page to upload a custom image (one-time, cannot be overwritten)
- **Export**: daily mail report (copy or .txt download) and Excel export (current day, current week, or month with colour-coded tabs)

## Tech stack

| Component       | Technology                                      |
|-----------------|-------------------------------------------------|
| Backend         | Python 3.11+ · FastAPI · SQLAlchemy             |
| Authentication  | JWT (python-jose) · Argon2id (argon2-cffi)      |
| Database        | SQLite                                          |
| Frontend        | React 18 · Vite                                 |
| Logging         | Python `logging` · RotatingFileHandler (10 MB)  |

## Project layout

```
pianifica/
├── backend/
│   ├── routers/
│   │   ├── auth.py          # register, login, logout + rate limiting
│   │   ├── account.py       # password change
│   │   ├── departments.py   # departments CRUD
│   │   ├── employees.py     # employees CRUD + avatar upload
│   │   ├── entries.py       # daily activities and absences
│   │   └── log.py           # log reader + UI events
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas (with length validation)
│   ├── auth.py              # JWT + Argon2id + master account
│   ├── rate_limit.py        # in-memory rate limiter
│   ├── logging_config.py    # rotating log setup
│   └── main.py              # entry point + error handlers + schema migration
├── frontend/
│   └── src/
│       ├── api.js           # fetch client + token management
│       ├── store.js         # date helpers and pure selectors
│       ├── i18n.jsx         # i18n provider (IT/EN/ES)
│       ├── App.jsx          # state + pages (calendar, settings, log)
│       ├── components.jsx   # UI (Topbar, DayView, WeekView, …, ActivityModal)
│       └── app.css          # light theme, orange topbar (Space Grotesk + JetBrains Mono)
├── data/                    # pianifica.db, avatars/, .secret (all gitignored)
├── pianifica.log            # runtime log (gitignored)
├── .env.example
├── CHANGELOG.md
└── LICENSE
```

## Setup

### 1. Backend

```powershell
cd pianifica
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

Copy `.env.example` to `.env` and optionally set a custom secret key (one is auto-generated on first run if not set):

```powershell
Copy-Item .env.example .env
# Optionally edit PIANIFICA_SECRET in .env
```

### 2. Frontend

```powershell
cd frontend
npm install
```

> **Corporate proxy with SSL inspection?** Run first: `npm config set strict-ssl false`

## Development

Two terminals:

```powershell
# Terminal 1 — Backend (from project root)
.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** — on first access you will be prompted to create an account.

## Production build

```powershell
cd frontend && npm run build && cd ..
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

FastAPI automatically serves the frontend from `frontend/dist/` on a single process.

## Master account

A built-in emergency account is always available regardless of the registered account:

| Field    | Value  |
|----------|--------|
| Username | `Melo` |
| Password | `Melo82` |

This account bypasses the database and cannot change its password. It is protected against timing attacks via `hmac.compare_digest`.

## System log

`pianifica.log` is created automatically in the project root on first startup.

Format: `[YYYY-MM-DD][HH:MM:SS][LEVEL]: description`

Every significant action is logged: logins, logouts, department/employee creation and modification, activity and absence updates, unhandled errors. UI events (view changes, modal opens, field edits) are sent from the frontend and written to the log.

The log is accessible **read-only** from the topbar (≡ Log button). It rotates automatically at 10 MB (5 backup files kept).

## Profile photos

In **Settings → Employees**, click on an employee's avatar to upload a photo (JPG/PNG/WebP, max 2 MB). The photo appears in all views and in the activity modal.

Images are saved in `data/avatars/` (gitignored).

## Security

| Measure | Detail |
|---|---|
| Password hashing | **Argon2id** — m=64 MB, t=3, p=4 (OWASP 2024 parameters) |
| JWT secret | Auto-generated on first run, stored in `data/.secret` (gitignored) |
| Rate limiting | 3 failed login attempts → 180-second lockout (per username, in-memory) |
| SQL injection | Impossible — all queries use parameterised SQLAlchemy ORM |
| XSS | React automatically escapes all dynamic content |
| Log injection | CR/LF stripped from all user-supplied strings before logging |
| Upload validation | MIME type (`image/*`), extension whitelist, max 2 MB |
| CORS | Development: restricted to `http://localhost:5173` |
| Swagger docs | Disabled in production (`docs_url=None`) |

## Database migration

`data/pianifica.db` is **never deleted** by updates.

- **First run**: `create_all` creates tables automatically.
- **Schema changes**: the app auto-migrates safe `ADD COLUMN` operations at startup. For destructive changes use Alembic.

```powershell
# Generate a migration after editing models.py
alembic revision --autogenerate -m "description"

# Apply (preserves data)
alembic upgrade head
```

## Updating

```powershell
git pull
pip install -r backend\requirements.txt
cd frontend && npm install && npm run build && cd ..
alembic upgrade head   # only if there are new migrations
uvicorn backend.main:app
```

## License

MIT — see [LICENSE](LICENSE).
