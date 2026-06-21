import os
import hmac as _hmac
import secrets
from types import SimpleNamespace
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from . import models
from ._paths import DATA_DIR

_SECRET_FILE = DATA_DIR / ".secret"


def _load_secret() -> str:
    env = os.getenv("PIANIFICA_SECRET", "")
    if len(env) >= 32:
        return env
    if _SECRET_FILE.exists():
        s = _SECRET_FILE.read_text(encoding="utf-8").strip()
        if len(s) >= 32:
            return s
    s = secrets.token_hex(32)
    _SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SECRET_FILE.write_text(s, encoding="utf-8")
    return s


SECRET_KEY = _load_secret()
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8

_bearer = HTTPBearer()

# Argon2id — vincitore della Password Hashing Competition (2015), parametri OWASP raccomandati
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# Account master di emergenza (bypass DB, credenziali fisse)
MASTER_ID = "_master"
_MASTER_USER = "melo"
_MASTER_PASS = "Melo82"


def is_master_login(username: str, password: str) -> bool:
    """Verifica le credenziali master con constant-time comparison (anti timing-attack)."""
    u_ok = _hmac.compare_digest(username.lower(), _MASTER_USER)
    p_ok = _hmac.compare_digest(password, _MASTER_PASS)
    return u_ok and p_ok


def hash_password(plain: str) -> str:
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        _ph.verify(hashed, plain)
        return True
    except (VerifyMismatchError, InvalidHashError, Exception):
        return False


def create_token(account_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": account_id, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def current_account(
    cred: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.Account:
    try:
        payload = jwt.decode(cred.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        account_id: str = payload.get("sub")
        if not account_id:
            raise ValueError("no sub")
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido o scaduto",
        )

    # Account master: non esiste nel DB, restituisce oggetto virtuale
    if account_id == MASTER_ID:
        return SimpleNamespace(
            id=MASTER_ID,
            user="Melo",
            company="",
            password_hash="",
        )

    acc = db.get(models.Account, account_id)
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account non trovato",
        )
    return acc
