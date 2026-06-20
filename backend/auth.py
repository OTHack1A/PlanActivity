import os
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from . import models

SECRET_KEY = os.getenv("PIANIFICA_SECRET", "dev-secret-please-change-in-production")
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
    acc = db.get(models.Account, account_id)
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account non trovato",
        )
    return acc
