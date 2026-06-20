# Changelog

Tutte le modifiche notevoli a questo progetto sono documentate qui.

## [1.1.0] — 2026-06-20

### Aggiunto
- **Log di sistema** (`pianifica.log` nella root del progetto) — registra login/logout, creazione e modifica di reparti e dipendenti, aggiornamenti attività e assenze, errori non gestiti. Formato: `[YYYY-MM-DD][HH:MM:SS][LEVEL]: messaggio`.
- **Log viewer nel frontend** — pulsante "≡ Log" in topbar (accanto a Impostazioni) che apre una pagina di sola lettura con gli ultimi 500 eventi, aggiornamento automatico ogni 5 secondi.
- **Logging azioni UI** — click su bottoni e modifiche ai campi (prima/dopo) vengono inviati al backend e scritti nel log.
- **Foto profilo dipendenti** — upload di immagini (JPG/PNG/WebP, max 2 MB) via click sull'avatar in Impostazioni; visualizzazione in tutte le viste (Giorno, Settimana) e nella modale attività.
- **Password hashing Argon2id** — sostituisce bcrypt con Argon2id (vincitore PHC 2015, parametri OWASP: m=64 MB, t=3, p=4).
- **Gestione errori globale** — ogni eccezione non gestita viene catturata, loggata con stack trace e restituisce 500 JSON al client.

### Modificato
- `requirements.txt`: rimosso `bcrypt`, aggiunto `argon2-cffi>=23.1`.
- Tutti i router ora emettono eventi di log semantici.
- `EmployeeOut` include il campo `hasAvatar: bool`.

## [1.0.0] — 2026-06-20

### Aggiunto
- Backend FastAPI con SQLite (SQLAlchemy ORM), JWT, Alembic.
- Frontend React 18 + Vite con viste Giorno, Settimana, Mese, Anno.
- Gestione reparti, dipendenti, attività giornaliere e assenze (ferie/malattia/permesso).
- Autenticazione singolo utente (registrazione + login + cambio password).
- Build di produzione: FastAPI serve anche il frontend da `frontend/dist/`.
