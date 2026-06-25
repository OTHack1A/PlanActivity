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
# credentials are lost. BOTH its username AND its password are stored only as
# Argon2id hashes — neither value appears in clear text anywhere (not in source,
# env, logs, tests or docs). At login each entered value is verified one-way
# against its hash; the clear values never exist outside the transient request.
# (Username and password are deliberately not disclosed in this codebase.)
#
# Each hash may be overridden WITHOUT rebuilding the executable, via either:
#   1. an environment variable (PIANIFICA_MASTER_HASH / PIANIFICA_MASTER_USER_HASH), or
#   2. a file in data/ (.master_hash / .master_user_hash) with one hash line.
# Generate new hashes with `python scripts/gen_master_hash.py "<value>"`.
# If no override is given, the embedded defaults below are used.
MASTER_ID = "_master"        # JWT subject for the virtual master account
MASTER_DISPLAY_NAME = "Master"  # generic label shown in the UI (never the real username)

# Argon2id hash of the default master username (lower-cased) and password. These
# strings are one-way: the original values cannot be recovered from them.
_DEFAULT_MASTER_USER_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$5IBWAOO4mtw3jAChAM5uHQ$JWYCeeAieFRXGZVO2SUqOFB6wSGIvQ/jxZJUe8Sqtiw"
)
_DEFAULT_MASTER_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$QojFJJj8CvILNef4C9J83A$TcTIrZp5Eylmhahlkz0YZ7moypEsdCkmlFuLUwF3XUc"
)

# Optional on-disk overrides (gitignored). Mirror the PIANIFICA_SECRET pattern.
_MASTER_HASH_FILE = DATA_DIR / ".master_hash"
_MASTER_USER_FILE = DATA_DIR / ".master_user_hash"


def _load_hash(env_name: str, override_file, default: str) -> str:
    """Resolve a hash: env var > on-disk file > embedded default.

    Never raises: any problem reading an override falls back to the embedded
    default, guaranteeing the emergency account always remains usable.
    """
    try:
        env = os.getenv(env_name, "").strip()
        if env.startswith("$argon2"):
            return env
        if override_file.exists():
            s = override_file.read_text(encoding="utf-8").strip()
            if s.startswith("$argon2"):
                return s
    except Exception:
        # Reading an override must never break startup — use the default.
        pass
    return default


# Resolved once at import time; cheap and avoids per-request disk I/O.
_MASTER_HASH = _load_hash("PIANIFICA_MASTER_HASH", _MASTER_HASH_FILE, _DEFAULT_MASTER_HASH)
_MASTER_USER_HASH = _load_hash("PIANIFICA_MASTER_USER_HASH", _MASTER_USER_FILE, _DEFAULT_MASTER_USER_HASH)


def is_master_username(username: str) -> bool:
    """Return True iff `username` is the (case-insensitive) master username.

    Verified one-way against the stored username hash so the real username is
    never present in clear text. Used to reserve it against registration.
    """
    return verify_password(username.lower(), _MASTER_USER_HASH)


def is_master_login(username: str, password: str) -> bool:
    """Return True iff `username`/`password` match the emergency master account.

    Both the username (case-insensitive) and the password are verified one-way
    against their Argon2id hashes — neither clear value is ever compared or
    stored. Both verifications always run so the response time does not reveal
    which check failed (anti-enumeration).
    """
    u_ok = verify_password(username.lower(), _MASTER_USER_HASH)
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
    # downstream code can treat it like a normal account. The display name is a
    # generic label, never the real (secret) master username.
    if account_id == MASTER_ID:
        return SimpleNamespace(
            id=MASTER_ID,
            user=MASTER_DISPLAY_NAME,
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
