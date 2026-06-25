"""
Authentication endpoints: registration status, register, login, logout.

This app is single-account: exactly one regular account may exist, plus the
virtual master/emergency account. Login is protected by per-username rate
limiting and never reveals whether a username exists (uniform 401).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import (
    hash_password, verify_password, create_token, current_account,
    is_master_login, MASTER_ID,
)
from ..rate_limit import check_lockout, record_failure, get_count, reset as rl_reset, MAX_ATTEMPTS
from ..logging_config import get_logger

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Usernames that cannot be registered because they collide with the master account.
_RESERVED_USERNAMES = {"melo"}


@router.get("/status", response_model=schemas.AuthStatusOut)
def auth_status(db: Session = Depends(get_db)):
    """Public: tell the frontend whether to show the login or the register screen."""
    registered = db.query(models.Account).first() is not None
    return {"registered": registered}


@router.post("/register", response_model=schemas.TokenOut, status_code=201)
def register(body: schemas.RegisterIn, db: Session = Depends(get_db)):
    """Create the single account (password length is validated by RegisterIn)."""
    # Only one regular account is allowed — block a second registration.
    if db.query(models.Account).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account già esistente. Usa il login.",
        )
    user = body.user.strip()
    if not user or not body.password:
        raise HTTPException(status_code=422, detail="Utente e password sono obbligatori")
    if not body.company.strip():
        raise HTTPException(status_code=422, detail="Il nome azienda è obbligatorio")
    if user.lower() in _RESERVED_USERNAMES:
        raise HTTPException(status_code=400, detail="Nome utente riservato, scegline un altro")
    acc = models.Account(
        user=user,
        password_hash=hash_password(body.password),
        company=body.company.strip(),
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    get_logger().info(f"Nuovo account registrato: utente '{user}' — azienda: '{acc.company}'")
    return {"access_token": create_token(acc.id)}


@router.post("/login", response_model=schemas.TokenOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    """Authenticate and return a JWT. Order: rate-limit -> master -> regular account."""
    user = body.user.strip()

    # 1. Rate limiting: reject early if this username is currently locked out.
    locked_for = check_lockout(user)
    if locked_for > 0:
        m, s = divmod(locked_for, 60)
        get_logger().warning(f"Login bloccato (rate limit): utente '{user}' — attendi {m}:{s:02d}")
        raise HTTPException(
            status_code=429,
            detail={"message": f"Troppi tentativi falliti. Riprova tra {m}:{s:02d}.", "retry_after": locked_for},
            headers={"Retry-After": str(locked_for)},
        )

    # 2. Master/emergency account: verified against a hash, never touches the DB.
    if is_master_login(user, body.password):
        rl_reset(user)  # successful login clears the failure counter
        get_logger().info(f"Login account master: utente '{user}'")
        return {"access_token": create_token(MASTER_ID)}

    # 3. Regular account: case-insensitive username, hash-verified password.
    acc = (
        db.query(models.Account)
        .filter(models.Account.user.ilike(user))
        .first()
    )
    # Same uniform 401 whether the user is missing or the password is wrong, so
    # the response does not reveal which usernames exist.
    if not acc or not verify_password(body.password, acc.password_hash):
        locked_now = record_failure(user)
        remaining = MAX_ATTEMPTS - (1 if not locked_now else 0)
        if locked_now:
            m, s = divmod(locked_now, 60)
            get_logger().warning(
                f"Accesso bloccato per {m}:{s:02d} dopo {MAX_ATTEMPTS} tentativi: utente '{user}'"
            )
        else:
            rimasti = max(0, MAX_ATTEMPTS - get_count(user))
            get_logger().warning(f"Tentativo di login fallito: utente '{user}' ({rimasti} tentativi rimasti)")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenziali non valide",
        )

    rl_reset(user)
    get_logger().info(f"Login riuscito: utente '{acc.user}'")
    return {"access_token": create_token(acc.id)}


@router.post("/logout")
def logout(acc: models.Account = Depends(current_account)):
    get_logger().info(f"Logout effettuato: utente '{acc.user}'")
    return {"ok": True}
