"""
Authentication & authorization core.

Responsibilities:
- Password hashing / verification with Argon2id (never store or compare plain text).
- JWT issuing and validation (HS256, short-lived tokens).
- The emergency "master" account, whose password is also stored *only* as a hash.

Security principle enforced throughout this module: a plain-text password exists
only transiently in memory while a request is being processed. It is never
written to disk, logged, embedded in source, or compared byte-for-byte — every
comparison goes through the one-way Argon2id verifier.
"""
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

# File holding the auto-generated JWT signing secret (gitignored, per-machine).
_SECRET_FILE = DATA_DIR / ".secret"


def _load_secret() -> str:
    """Resolve the JWT signing secret: env var > on-disk file > freshly generated.

    A new 64-hex-char secret is created and persisted on first run so tokens stay
    valid across restarts. Requiring >= 32 chars rejects accidentally-empty values.
    """
    env = os.getenv("PIANIFICA_SECRET", "")
    if len(env) >= 32:
        return env
    if _SECRET_FILE.exists():
        s = _SECRET_FILE.read_text(encoding="utf-8").strip()
        if len(s) >= 32:
            return s
    # Nothing usable found — generate, persist, and return a fresh secret.
    s = secrets.token_hex(32)
    _SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SECRET_FILE.write_text(s, encoding="utf-8")
    return s


SECRET_KEY = _load_secret()
ALGORITHM = "HS256"          # symmetric signing — fine for a single-server app
TOKEN_EXPIRE_HOURS = 8       # tokens expire after one working day

# Bearer-token extractor used as a FastAPI dependency on protected endpoints.
_bearer = HTTPBearer()

# Argon2id — winner of the Password Hashing Competition (2015). Parameters follow
# the OWASP recommendations: 64 MB memory, 3 iterations, 4 lanes.
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(plain: str) -> str:
    """Return an Argon2id hash (with embedded random salt + parameters) for `plain`."""
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify `plain` against an Argon2id `hashed` string.

    Returns True/False and never raises: any error (mismatch, malformed hash,
    unexpected exception) is treated as a failed verification so a bad stored
    value can never crash the login path.
    """
    try:
        _ph.verify(hashed, plain)
        return True
    except (VerifyMismatchError, InvalidHashError, Exception):
        return False


# ---------------------------------------------------------------------------
# Master / emergency account
# ---------------------------------------------------------------------------
# The master account lets the operator regain access if the regular account's
# credentials are lost. Like any account, its PASSWORD is stored only as an
# Argon2id hash — the clear password appears nowhere (not in source, env, or
# logs). At login the entered password is verified against this hash one-way.
#
# The hash may be overridden WITHOUT rebuilding the executable, via either:
#   1. the PIANIFICA_MASTER_HASH environment variable, or
#   2. a `data/.master_hash` file containing a single Argon2id hash line.
# To change the master password, generate a new hash with
# `python scripts/gen_master_hash.py "<new password>"` and supply it through
# (1) or (2). If neither is provided, the embedded default below is used.
MASTER_ID = "_master"        # JWT subject for the virtual master account
_MASTER_USER = "melo"        # the username is public; only the password is secret

# Argon2id hash of the default emergency password. This string is one-way: the
# original password cannot be recovered from it. Override it to rotate the
# master password (see note above).
_DEFAULT_MASTER_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$n8UiAutjZ+z1G42fqOx4/w$uDC2HlwkYkaBBADi9nUFK1Fd+6E1IYGJUwVbsiF2cmk"
)

# Optional on-disk override (gitignored). Mirrors the PIANIFICA_SECRET pattern.
_MASTER_HASH_FILE = DATA_DIR / ".master_hash"


def _load_master_hash() -> str:
    """Resolve the master password hash: env var > file > embedded default.

    Never raises: any problem reading the override falls back to the embedded
    default, guaranteeing the emergency account always remains usable.
    """
    try:
        env = os.getenv("PIANIFICA_MASTER_HASH", "").strip()
        if env.startswith("$argon2"):
            return env
        if _MASTER_HASH_FILE.exists():
            s = _MASTER_HASH_FILE.read_text(encoding="utf-8").strip()
            if s.startswith("$argon2"):
                return s
    except Exception:
        # Reading an override must never break startup — use the default.
        pass
    return _DEFAULT_MASTER_HASH


# Resolved once at import time; cheap and avoids per-request disk I/O.
_MASTER_HASH = _load_master_hash()


def is_master_login(username: str, password: str) -> bool:
    """Return True iff `username`/`password` match the emergency master account.

    - Username is compared in constant time (`hmac.compare_digest`).
    - Password is verified against the stored Argon2id hash (one-way) — the clear
      password is never compared or stored.
    The password verification always runs, even when the username does not match,
    so the response time does not reveal *which* check failed (anti-enumeration).
    """
    u_ok = _hmac.compare_digest(username.lower(), _MASTER_USER)
    p_ok = verify_password(password, _MASTER_HASH)
    return u_ok and p_ok


def create_token(account_id: str) -> str:
    """Issue a signed JWT whose subject is the account id, expiring in 8 hours."""
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": account_id, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def current_account(
    cred: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.Account:
    """FastAPI dependency: resolve the authenticated account from the bearer token.

    Raises 401 for any invalid/expired token. The master account is virtual (it
    has no DB row), so a synthetic object is returned for it.
    """
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

    # Master account: not in the DB — return a lightweight virtual object so
    # downstream code can treat it like a normal account.
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
