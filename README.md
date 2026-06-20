# Pianifica

Gestionale per pianificare le attività giornaliere dei dipendenti di un'officina.

## Caratteristiche

- **Viste multiple**: Giorno, Settimana, Mese, Anno
- **Reparti e dipendenti** con foto profilo e ore di straordinario
- **Attività giornaliere** con ore previste e note
- **Assenze**: ferie, malattia, permesso
- **Log di sistema** con viewer integrato nel frontend (sola lettura)
- **Autenticazione JWT** con password hashata con Argon2id
- **Database SQLite** che persiste tra gli aggiornamenti

## Stack

| Componente | Tecnologia |
|---|---|
| Backend | Python 3.11+ · FastAPI · SQLAlchemy · Alembic |
| Autenticazione | JWT (python-jose) · Argon2id (argon2-cffi) |
| Database | SQLite |
| Frontend | React 18 · Vite |
| Logging | Python `logging` · RotatingFileHandler |

## Struttura

```
pianifica/
├── backend/
│   ├── routers/
│   │   ├── auth.py         # registrazione, login, logout
│   │   ├── account.py      # cambio password
│   │   ├── departments.py  # CRUD reparti
│   │   ├── employees.py    # CRUD dipendenti + avatar
│   │   ├── entries.py      # attività e assenze
│   │   └── log.py          # lettura log + eventi UI
│   ├── alembic/            # migrazioni database
│   ├── models.py           # modelli SQLAlchemy
│   ├── schemas.py          # schemi Pydantic
│   ├── auth.py             # JWT + Argon2id
│   ├── logging_config.py   # configurazione log
│   └── main.py             # entry point + error handlers
├── frontend/
│   └── src/
│       ├── api.js          # client fetch + token
│       ├── store.js        # helper date e selettori
│       ├── App.jsx         # state + pagine (calendario, impostazioni, log)
│       ├── components.jsx  # UI (Topbar, DayView, WeekView, ..., ActivityModal)
│       └── app.css         # tema dark (Space Grotesk + JetBrains Mono)
├── data/                   # pianifica.db e avatars/ (gitignored)
├── pianifica.log           # log a runtime (gitignored)
├── alembic.ini
├── .env.example
├── CHANGELOG.md
└── LICENSE
```

## Setup iniziale

### 1. Backend

```powershell
cd pianifica
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

Copia `.env.example` in `.env` e imposta una chiave segreta lunga e casuale:

```powershell
Copy-Item .env.example .env
# Modifica PIANIFICA_SECRET nel file .env
```

### 2. Frontend

```powershell
cd frontend
npm install
```

> **Rete aziendale con proxy SSL?** Prima esegui: `npm config set strict-ssl false`

## Avvio (sviluppo)

Due terminali:

```powershell
# Terminale 1 — Backend (dalla root del progetto)
.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload

# Terminale 2 — Frontend
cd frontend
npm run dev
```

Apri **http://localhost:5173** — al primo accesso ti verrà chiesto di creare un account.

## Build per produzione

```powershell
cd frontend && npm run build && cd ..
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

FastAPI serve automaticamente il frontend da `frontend/dist/` su un unico processo.

## Log di sistema

Il file `pianifica.log` viene creato automaticamente nella root del progetto al primo avvio.

Formato: `[YYYY-MM-DD][HH:MM:SS][INFO]: descrizione`

Ogni azione significativa viene registrata: login, logout, creazione/modifica/eliminazione di reparti e dipendenti, aggiornamento attività e assenze, errori. Le azioni UI (cambi vista, apertura modale, modifiche ai campi) vengono inviate dal frontend al backend e scritte nel log.

Il log è accessibile in **sola lettura** dalla topbar dell'app (pulsante "≡ Log").

## Foto profilo

In **Impostazioni → Dipendenti**, clicca sull'avatar di un dipendente per caricare una foto (JPG/PNG/WebP, max 2 MB). La foto appare in tutte le viste e nella modale attività.

Le immagini sono salvate in `data/avatars/` (gitignored).

## Sicurezza

- **Password**: hashata con **Argon2id** (m=64 MB, t=3, p=4 — parametri OWASP 2024)
- **SQL injection**: impossibile — tutte le query usano SQLAlchemy ORM parametrizzato
- **XSS**: React esegue escaping automatico di tutto il contenuto dinamico
- **Injection OS**: il backend non esegue mai comandi di shell
- **Upload avatar**: validazione MIME type (`image/*`), estensione (jpg/png/webp), dimensione (max 2 MB)
- **JWT**: token HS256 con scadenza 8 ore, chiave segreta configurabile via `.env`
- **CORS**: in sviluppo limitato a `http://localhost:5173`

> Assicurati di impostare `PIANIFICA_SECRET` nel file `.env` con una stringa casuale di almeno 32 caratteri prima di andare in produzione.

## Migrazioni database

Il database `data/pianifica.db` **non viene mai cancellato** dagli aggiornamenti.

- **Primo avvio**: `create_all` crea le tabelle automaticamente.
- **Nuove versioni con modifiche allo schema**: usa Alembic.

```powershell
# Genera una migrazione dopo aver modificato models.py
alembic revision --autogenerate -m "descrizione"

# Applica (preserva i dati)
alembic upgrade head
```

## Aggiornare l'app

```powershell
git pull
pip install -r backend\requirements.txt
cd frontend && npm install && npm run build && cd ..
alembic upgrade head   # solo se ci sono nuove migrazioni
uvicorn backend.main:app
```

## Licenza

MIT — vedi [LICENSE](LICENSE).
