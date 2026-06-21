# Deployment Guide

This guide covers every step needed to get Pianifica running — from a local
workstation to a production Linux server, including the GitHub workflow for
updating an existing installation.

---

## Requirements

| Component | Minimum version |
|---|---|
| Python | 3.11 |
| pip | 23+ |
| Node.js | 18+ |
| npm | 9+ |

SQLite is bundled with Python — no separate database installation required.

---

## 1. First-time setup (any platform)

### Clone the repository

```bash
git clone https://github.com/<your-username>/pianifica.git
cd pianifica
```

### Backend

```bash
# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\Activate.ps1          # PowerShell
# .venv\Scripts\activate.bat        # cmd

# Linux / macOS
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### Frontend (build for production)

```bash
cd frontend
npm install
npm run build
cd ..
```

The build output goes to `frontend/dist/`, which FastAPI serves automatically.

### Environment (optional)

```bash
cp .env.example .env
# Edit PIANIFICA_SECRET if you want a fixed JWT secret.
# If left unset, a random 256-bit secret is generated on first run
# and stored in data/.secret (gitignored).
```

---

## 2. Running in development

Two terminals required:

```bash
# Terminal 1 — backend (auto-reload on save)
source .venv/bin/activate          # or .venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload

# Terminal 2 — frontend dev server (hot-module reload)
cd frontend
npm run dev
```

Open **http://localhost:5173** — the first visit shows the registration screen.

---

## 3. Windows standalone executable (company deployment)

The easiest way to deploy on a Windows workstation — no Python or Node
installation required.

### Build the exe (one-time, on a machine with the dev environment)

```powershell
# Activate venv and build
.venv\Scripts\Activate.ps1
pyinstaller pianifica.spec
```

The output is `dist\pianifica.exe` (~27 MB, self-contained).

### Deploy

1. Copy **only** `dist\pianifica.exe` to any folder (e.g. `C:\Pianifica\`)
2. Double-click to launch — **no console window appears**; the app runs in the
   background
3. Open **http://127.0.0.1:16853** in any browser

On first launch the app automatically creates:

```
C:\Pianifica\
├── pianifica.exe
├── pianifica.log          ← runtime log (10 MB × 5 rotating)
└── data\
    ├── pianifica.db       ← SQLite database
    └── .secret            ← JWT signing key (auto-generated)
```

### Stopping the app

Open Task Manager → find **pianifica.exe** → End Task.
Or from PowerShell: `Stop-Process -Name pianifica -Force`

### Updating

Replace `pianifica.exe` with the new build (the `data\` folder is untouched).

---

## 4. Running in production (single process, Linux/server)

After running `npm run build` once, the backend serves everything:

```bash
source .venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Open **http://<server-ip>:8000**.

> **Note**: the `data/` directory (database, avatars, JWT secret) is created
> automatically on first run. Make sure the process user has write access to
> the project directory.

---

## 5. Running as a systemd service (Linux)

Create `/etc/systemd/system/pianifica.service`:

```ini
[Unit]
Description=Pianifica workshop planner
After=network.target

[Service]
Type=simple
User=pianifica
WorkingDirectory=/opt/pianifica
ExecStart=/opt/pianifica/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pianifica
sudo systemctl status pianifica
```

---

## 6. Reverse proxy with nginx (recommended for production)

Place nginx in front so it handles TLS and serves static files efficiently.

`/etc/nginx/sites-available/pianifica`:

```nginx
server {
    listen 80;
    server_name pianifica.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name pianifica.example.com;

    ssl_certificate     /etc/letsencrypt/live/pianifica.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pianifica.example.com/privkey.pem;

    # Serve pre-built static assets directly (avoids Python overhead)
    root /opt/pianifica/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        client_max_body_size 3M;   # must be ≥ avatar/logo upload limit (2 MB)
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pianifica /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

When using nginx to serve static files, update CORS in `backend/main.py`:

```python
allow_origins=["https://pianifica.example.com"],
```

Or load from an environment variable:

```python
import os
_origins = os.getenv("PIANIFICA_CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=_origins, ...)
```

---

## 7. Updating an existing installation

```bash
cd /opt/pianifica

# Pull latest code
git pull

# Update Python dependencies (safe — never drops packages automatically)
.venv/bin/pip install -r backend/requirements.txt

# Rebuild frontend
cd frontend && npm install && npm run build && cd ..

# Apply any DB schema migrations (safe — only ADD COLUMN, never destructive)
# Most updates run the auto-migration at startup — Alembic only needed for
# breaking schema changes (see CHANGELOG for per-release notes).
# .venv/bin/alembic upgrade head

# Restart the service
sudo systemctl restart pianifica
```

> **Database safety**: `data/pianifica.db` is never deleted or truncated by
> updates. The app auto-migrates safe `ADD COLUMN` operations at startup.

---

## 8. GitHub repository setup

### Push for the first time

```bash
cd pianifica
git remote add origin https://github.com/<your-username>/pianifica.git
git push -u origin master
```

### What is and is not committed

| Path | Committed | Reason |
|---|---|---|
| `backend/` | Yes | application code |
| `frontend/src/` | Yes | source code |
| `run.py` | Yes | exe entry point |
| `pianifica.spec` | Yes | PyInstaller build config |
| `logo.ico` | Yes | exe icon |
| `frontend/dist/` | **No** | generated build (gitignored) |
| `build/` | **No** | PyInstaller temp (gitignored) |
| `dist/` | **No** | compiled exe (gitignored) |
| `data/pianifica.db` | **No** | instance data |
| `data/avatars/` | **No** | user uploads |
| `data/logo.*` | **No** | custom logo |
| `data/.secret` | **No** | JWT secret |
| `pianifica.log` | **No** | runtime log |
| `.venv/` | **No** | virtual environment |
| `node_modules/` | **No** | npm packages |

Clone recipients must run the **First-time setup** steps above to recreate
everything that is not committed.

---

## 9. Persisted data and backup

Everything instance-specific lives under `data/`:

```
data/
├── pianifica.db      # SQLite database (departments, employees, activities)
├── avatars/          # employee profile photos
├── logo.png          # custom login logo (one-time upload, cannot be changed)
└── .secret           # JWT signing secret (auto-generated)
```

**Minimal backup script:**

```bash
#!/bin/bash
DEST=/backups/pianifica/$(date +%Y-%m-%d)
mkdir -p "$DEST"
cp -r /opt/pianifica/data "$DEST/"
echo "Backup saved to $DEST"
```

Add to cron: `0 2 * * * /opt/pianifica/backup.sh`

---

## 10. Environment variables

| Variable | Default | Description |
|---|---|---|
| `PIANIFICA_SECRET` | _(auto-generated)_ | JWT signing secret (≥32 chars) |
| `PIANIFICA_MASTER_PASS` | `Melo82` | Emergency master account password |

Set them in `.env` (copied from `.env.example`) or export directly:

```bash
export PIANIFICA_SECRET="your-long-random-secret-here"
export PIANIFICA_MASTER_PASS="change-this-in-production"
```

> The master account username is always `Melo` (case-insensitive).

---

## 11. First run checklist

- [ ] Backend starts without errors (`uvicorn` output shows "Applicazione Pianifica avviata")
- [ ] Opening the URL shows the registration screen (or login if already registered)
- [ ] Upload a custom logo on the login page (optional — one-time only)
- [ ] Register an account (username, password, company name)
- [ ] Log in and create at least one department and one employee
- [ ] Verify the log viewer (≡ Log button in topbar) shows startup events
- [ ] Export an Excel file to confirm SheetJS is working

---

## 12. Security checklist for production

- [ ] Set a strong `PIANIFICA_SECRET` (≥ 64 random hex chars: `python -c "import secrets; print(secrets.token_hex(32))"`)
- [ ] Change `PIANIFICA_MASTER_PASS` from the default `Melo82`
- [ ] Enable HTTPS (Let's Encrypt via Certbot is free)
- [ ] Restrict port 8000 to localhost if using nginx (`--host 127.0.0.1`)
- [ ] Set up a firewall (only 80/443 public)
- [ ] Set up automated backups of `data/`
- [ ] Review `CHANGELOG.md` for any breaking changes before updating
