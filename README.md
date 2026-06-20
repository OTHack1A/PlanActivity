# Pianifica

Gestionale per pianificare le attività giornaliere dei dipendenti di un'officina.

## Stack

- **Backend**: Python 3.11+ · FastAPI · SQLite (via SQLAlchemy) · JWT (python-jose) · bcrypt (passlib) · Alembic (migrazioni DB)
- **Frontend**: React 18 · Vite · fetch API

## Struttura

```
pianifica/
├── backend/          # API FastAPI
│   ├── routers/      # auth, account, departments, employees, entries
│   ├── alembic/      # migrazioni database
│   ├── models.py     # modelli SQLAlchemy
│   ├── schemas.py    # schemi Pydantic
│   ├── auth.py       # JWT + bcrypt
│   └── main.py       # app entry point
├── frontend/         # React + Vite
│   └── src/
│       ├── api.js    # client API (fetch + token)
│       ├── store.js  # helper date e selettori puri
│       ├── App.jsx   # componente principale
│       ├── components.jsx
│       └── app.css
├── data/             # pianifica.db (gitignored, resta sulla macchina)
└── alembic.ini
```

## Setup iniziale

### 1. Backend

```powershell
cd pianifica
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

Copia `.env.example` in `.env` e modifica `PIANIFICA_SECRET` con una stringa casuale lunga.

### 2. Frontend

```powershell
cd frontend
npm install
```

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

Poi apri **http://localhost:5173**

## Build per produzione (un solo processo)

```powershell
cd frontend
npm run build          # genera frontend/dist/
cd ..
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

FastAPI serve automaticamente il frontend da `frontend/dist/`.

## Migrazioni database (aggiornamenti futuri)

Il database `data/pianifica.db` **non viene mai cancellato** dagli aggiornamenti.

- **Primo avvio**: `create_all` crea le tabelle se non esistono.
- **Nuove versioni con modifiche allo schema**: usa Alembic.

```powershell
# Crea una migrazione dopo aver modificato models.py
alembic revision --autogenerate -m "descrizione della modifica"

# Applica la migrazione (preserva i dati)
alembic upgrade head
```

## Aggiornare l'app

```powershell
git pull
pip install -r backend\requirements.txt   # solo se aggiornate le dipendenze
cd frontend && npm install && npm run build && cd ..
alembic upgrade head                       # solo se ci sono migrazioni
uvicorn backend.main:app
```
