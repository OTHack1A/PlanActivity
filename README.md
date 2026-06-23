# PlanActivity

Daily activity planner for workshop employees. Manage departments, staff, activities, and absences through a clean multi-view calendar interface — available as a zero-install Windows executable or as a self-hosted web server.

---

## Features

- **Multiple views**: Day, Week, Month, Year
- **Previous day button** — quick navigation from the Day view
- **Sundays in red** — highlighted across all calendar views
- **Saturday half-day** — optional setting to count Saturday as 4 h instead of 8 h
- **Departments & employees** with profile photos and overtime hours
- **Daily activities** with planned hours and notes
- **Absences**: vacation, sick leave, leave of absence
- **Excel export**: current day, current week, or full month (colour-coded tabs)
- **Mail-report export**: copy to clipboard or download as `.txt`
- **System log** with a built-in read-only viewer in the topbar
- **JWT authentication** with Argon2id password hashing (OWASP parameters)
- **Rate limiting**: 3 failed attempts → 3-minute lockout per username
- **SQLite database** that survives updates (auto-migrated at startup)
- **Multilingual UI**: Italian, English, Spanish, Ukrainian (Cyrillic supported)
- **Customisable logo**: upload your company logo on the login screen (one-time, permanent)

---

## Quick start — Windows (no installation required)

1. Download **`pianifica-windows.exe`** from the [Releases](../../releases) page
2. Rename it to `pianifica.exe` and place it in any folder (e.g. `C:\PlanActivity\`)
3. Double-click to launch — no console window, your browser opens automatically
4. Create your account on first access

> The app listens on all network interfaces. Other devices on your LAN can connect at
> `http://<your-ip>:16853` (the exact URL is written to `pianifica.log` at startup).
> To stop: **Task Manager → `pianifica.exe` → End Task**.

The app creates its data folder automatically:

```
C:\PlanActivity\
├── pianifica.exe
├── pianifica.log          ← rotating log (10 MB × 5 files)
└── data\
    ├── pianifica.db       ← SQLite database
    └── .secret            ← auto-generated JWT key
```

> If the folder is read-only (e.g. `Program Files`), data is stored in
> `%LOCALAPPDATA%\Pianifica\data\` instead.

To stop the app: Task Manager → `pianifica.exe` → End Task  
To update: replace `pianifica.exe` (the `data\` folder is never touched)

---

## Tech stack

| Component      | Technology                                    |
|----------------|-----------------------------------------------|
| Backend        | Python 3.11+ · FastAPI · SQLAlchemy           |
| Authentication | JWT (python-jose) · Argon2id (argon2-cffi)    |
| Database       | SQLite (bundled with Python)                  |
| Frontend       | React 18 · Vite · SheetJS (Excel export)      |
| Logging        | Python `logging` · RotatingFileHandler 10 MB  |

---

## Project layout

```
planactivity/
├── backend/
│   ├── routers/
│   │   ├── auth.py          # register, login, logout, rate limiting
│   │   ├── account.py       # password change
│   │   ├── departments.py   # departments CRUD
│   │   ├── employees.py     # employees CRUD + avatar upload (magic-byte validated)
│   │   ├── entries.py       # daily activities and absences
│   │   ├── log.py           # log reader + UI events
│   │   └── logo.py          # company logo upload and serving
│   ├── _paths.py            # path resolver (dev vs frozen exe)
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas with length validation
│   ├── auth.py              # JWT + Argon2id
│   ├── rate_limit.py        # in-memory rate limiter
│   ├── logging_config.py    # rotating log setup
│   └── main.py              # app entry point + error handlers
├── frontend/
│   └── src/
│       ├── api.js           # fetch client + token management
│       ├── store.js         # date helpers and pure selectors
│       ├── i18n.jsx         # IT / EN / ES / UK language provider
│       ├── App.jsx          # state + pages (calendar, settings, log)
│       ├── components.jsx   # UI components
│       └── app.css          # light theme, orange topbar
├── run.py                   # PyInstaller entry point
├── pianifica.spec           # PyInstaller build config
├── logo.ico                 # application icon (6 sizes, 16–256 px)
├── data/                    # db, avatars, .secret  ← gitignored
├── pianifica.log            # runtime log           ← gitignored
├── DEPLOY.md                # full deployment guide
├── USER_GUIDE.md            # end-user manual
├── CHANGELOG.md
└── LICENSE
```

---

## Development setup

### Backend

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

### Frontend

```powershell
cd frontend
npm install
```

> **Corporate proxy with SSL inspection?** Run first: `npm config set strict-ssl false`

### Run in development mode

Two terminals:

```powershell
# Terminal 1 — backend (auto-reload)
.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload

# Terminal 2 — frontend (hot-module reload)
cd frontend
npm run dev
```

Open **http://localhost:5173**. The first visit shows the registration screen.

---

## Build executables

### Local build (current platform)

```powershell
.venv\Scripts\Activate.ps1
cd frontend && npm run build && cd ..
pyinstaller pianifica.spec --noconfirm
```

Output: `dist\pianifica.exe` (Windows) or `dist/pianifica` (Linux/macOS).

### Automated multi-platform release (GitHub Actions)

Push a version tag to trigger automatic builds for all three platforms:

```powershell
git tag v1.6.0
git push origin v1.6.0
```

GitHub Actions (`.github/workflows/release.yml`) will build on `windows-latest`,
`ubuntu-latest`, and `macos-latest`, then publish `pianifica-windows.exe`,
`pianifica-linux`, and `pianifica-macos` as a GitHub Release.

> See [DEPLOY.md](DEPLOY.md) for platform-specific instructions and server deployment.

---

## Production deployment (server / Linux)

```bash
npm run build            # build the frontend once
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

See [DEPLOY.md](DEPLOY.md) for systemd service, nginx + TLS, and backup instructions.

---

## Security

| Measure | Detail |
|---|---|
| Password hashing | **Argon2id** — m=64 MB, t=3, p=4 (OWASP 2024 parameters) |
| JWT secret | Auto-generated on first run, stored in `data/.secret` (gitignored) |
| Rate limiting | 3 failed login attempts → 180-second lockout per username |
| SQL injection | Impossible — all queries use parameterised SQLAlchemy ORM |
| XSS | React automatically escapes all dynamic content |
| Upload validation | Magic-byte file-type check + extension whitelist + 2 MB size limit |
| Log injection | CR/LF stripped from all user-supplied strings before logging |
| Input validation | Pydantic `max_length` enforced on every API field |
| Swagger docs | Disabled in production (`docs_url=None`) |

---

## Database

`data/pianifica.db` is **never deleted** by updates.

- **First run**: tables are created automatically via `create_all`.
- **Schema changes**: safe `ADD COLUMN` operations are auto-applied at startup.

---

## Updating

**Windows exe**: replace `pianifica.exe` — the `data\` folder is untouched.

**Server / source**:

```powershell
git pull
pip install -r backend\requirements.txt
cd frontend && npm install && npm run build && cd ..
```

---

## Deployment guide

See [DEPLOY.md](DEPLOY.md) for the full guide covering Windows exe, single-process
production server, systemd service, nginx + TLS, backups, and environment variables.

## User guide

See [USER_GUIDE.md](USER_GUIDE.md) for end-user instructions.

---

## License

MIT — see [LICENSE](LICENSE).
