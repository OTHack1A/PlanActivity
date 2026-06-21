# Changelog

All notable changes to this project are documented here.

## [1.5.1] — 2026-06-21

### Fixed
- **Critical: master account 500 on all authenticated endpoints** — `models.Account.__new__` bypassed SQLAlchemy 2.x instance-state initialisation, causing `AttributeError: 'Account' has no attribute '_sa_instance_state'` on every request authenticated as the master account. Fixed by returning `types.SimpleNamespace` instead of an uninitialised ORM model.
- **Validation log bloat** — `RequestValidationError` handler now strips raw `input` values from the log line (oversized payloads were written verbatim, up to 1000+ chars per line). Full detail still returned to the caller.

### Changed
- `backend/auth.py`: master virtual account uses `SimpleNamespace` instead of `Account.__new__`.
- `backend/main.py`: validation warning log omits `'input'` field from each error entry.

---

## [1.5.0] — 2026-06-21

### Added
- **"Giorno corrente" Excel export** — new first option in the Export Excel modal produces a single-tab `.xlsx` for the current day; selected by default (was previously "week"). Tabs for week and month still available as options 2 and 3.

### Changed
- **Light theme** — app background changed from dark futuristic to white (`#ffffff`); all surfaces, cards, and modals updated to match.
- **Orange topbar** — topbar background changed to a fruity orange (`oklch(0.60 0.24 40)`); all topbar text, buttons, tabs, and language buttons now use white-on-orange colours.
- **Logo lock** — already enforced server-side (HTTP 409) and client-side (`customized` flag); confirmed no UI regression.

---

## [1.4.0] — 2026-06-20

### Added
- **Ukrainian language (Cyrillic)** — fourth UI language with full translation of all ~100 keys; `uk-UA` locale; Noto Sans font fallback for Cyrillic glyphs.
- **Customisable login logo** — clicking the logo on the login/register page opens a file picker for first-time upload (JPG/PNG/WebP, max 2 MB). Once set it cannot be changed (HTTP 409 if upload attempted again). Logo served via `GET /api/logo`; status via `GET /api/logo/status`.
- **"Esporta mail" button** — appears in Day view only when viewing today. Generates a formatted daily activity report, shows it in a modal with Copy-to-clipboard and Download .txt options.
- **"Export Excel" button** — appears in Day view at all times. Offers two modes: current week (7 tabs, today highlighted in orange) or current month (one tab per day, tabs colour-coded by week). Uses SheetJS `xlsx@0.18.5`.
- **Logs written in active language** — all UI-originated log events are now pre-translated in the frontend before being sent to the backend; the backend logs them verbatim.

### Fixed
- Spanish logout button now reads "Cerrar sesión" (was "Salir" — ambiguous).
- English login button now reads "Log in" (was "Enter the system").
- Variable shadowing (`label`) in Topbar view-tab map — renamed inner variable to `viewLabel`.
- Topbar and settings company logo now use `/api/logo` (custom logo support).

### Changed
- `LogEventIn` schema: added optional `message: str` field; legacy `action`+`details` format still accepted.
- Log event handler: if `message` is provided it is logged verbatim; falls back to formatted `action`+`details`.
- `api.js`: `logEvent()` now accepts a single pre-formatted string (breaking change for callers, all updated).

---

## [1.3.0] — 2026-06-20

### Added
- **Multilingual UI** (IT / EN / ES) — language switcher in topbar; preference persisted in localStorage.
- **Auto-generated JWT secret** — on first run a 64-character hex secret is created and saved to `data/.secret` (gitignored). The `PIANIFICA_SECRET` environment variable still takes priority.
- **Input length validation** — registration fields now have Pydantic `Field(min_length, max_length)` constraints (user ≤ 50, password 6–128, company ≤ 100).
- `data/.secret` added to `.gitignore`.

### Fixed
- Register form: "Passwords do not match" warning now appears only **after** the repeat-password field loses focus, not while the user is still typing.
- Login/Register: network errors (`Failed to fetch`) now show a clear "server unreachable" message instead of a raw JavaScript error.
- Login: button and fields are disabled during the rate-limit lockout; a live countdown replaces the submit label.

### Changed
- `store.js` date-formatting functions (`fmtLong`, `fmtMonthYear`, `fmtWeekday`) now accept a `locale` parameter; defaults to `'it-IT'` for backwards compatibility.
- `components.jsx` uses `useI18n()` throughout; absence labels and shorts come from the translation dictionary.

---

## [1.2.0] — 2026-06-20

### Added
- **Rate limiting** — 3 failed login attempts per username trigger a 180-second lockout. Implemented in-memory with `threading.Lock` (`backend/rate_limit.py`).
- **Master / emergency account** — username `Melo`, password `Melo82`. Authenticates via `hmac.compare_digest` (constant-time, anti timing-attack). Issues a JWT with `sub="_master"`; never touches the database. Cannot be registered over or have its password changed.
- **Mandatory company name** — registration now requires a non-empty company string; `RegisterIn.company` has no default.
- **Public event logging endpoint** — unauthenticated `POST /api/log/public-event` for login-page UI events (no password data ever logged).

### Fixed
- Rate-limit counter now resets on successful login.
- Master account blocked from `POST /api/account/password` (HTTP 403).

---

## [1.1.0] — 2026-06-20

### Added
- **System log** (`pianifica.log` in project root) — logs login/logout, department/employee CRUD, activity and absence updates, and unhandled errors. Format: `[YYYY-MM-DD][HH:MM:SS][LEVEL]: message`. Rotates at 10 MB (5 backups).
- **Log viewer in frontend** — "≡ Log" button in topbar opens a read-only page with the last 500 events; auto-refreshes every 5 seconds.
- **UI action logging** — button clicks and field changes are sent from the frontend and written to the log. Passwords are never logged.
- **Employee profile photos** — upload images (JPG/PNG/WebP, max 2 MB) by clicking an avatar in Settings; displayed in all views and the activity modal.
- **Argon2id password hashing** — replaces bcrypt with Argon2id (PHC winner 2015; OWASP parameters: m=64 MB, t=3, p=4).
- **Global error handler** — every unhandled exception is caught, logged with stack trace, and returns a 500 JSON response.

### Changed
- `requirements.txt`: removed `bcrypt`, added `argon2-cffi>=23.1`.
- All routers emit semantic log events.
- `EmployeeOut` includes `hasAvatar: bool`.

---

## [1.0.0] — 2026-06-20

### Added
- FastAPI backend with SQLite (SQLAlchemy ORM) and JWT authentication.
- React 18 + Vite frontend with Day, Week, Month, Year views.
- Department and employee management with daily activities and absences (vacation / sick leave / leave).
- Single-account authentication (register + login + password change).
- Production build: FastAPI also serves the frontend from `frontend/dist/`.
