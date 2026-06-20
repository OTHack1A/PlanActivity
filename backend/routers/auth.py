from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import hash_password, verify_password, create_token, current_account
from ..logging_config import get_logger

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status", response_model=schemas.AuthStatusOut)
def auth_status(db: Session = Depends(get_db)):
    registered = db.query(models.Account).first() is not None
    return {"registered": registered}


@router.post("/register", response_model=schemas.TokenOut, status_code=201)
def register(body: schemas.RegisterIn, db: Session = Depends(get_db)):
    if db.query(models.Account).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account già esistente. Usa il login.",
        )
    user = body.user.strip()
    if not user or not body.password:
        raise HTTPException(status_code=422, detail="Utente e password sono obbligatori")
    acc = models.Account(
        user=user,
        password_hash=hash_password(body.password),
        company=body.company.strip(),
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    company_info = f" — azienda: '{acc.company}'" if acc.company else ""
    get_logger().info(f"Nuovo account registrato: utente '{user}'{company_info}")
    return {"access_token": create_token(acc.id)}


@router.post("/login", response_model=schemas.TokenOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    user = body.user.strip()
    acc = (
        db.query(models.Account)
        .filter(models.Account.user.ilike(user))
        .first()
    )
    if not acc or not verify_password(body.password, acc.password_hash):
        get_logger().warning(f"Tentativo di login fallito: utente '{user}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenziali non valide",
        )
    get_logger().info(f"Login riuscito: utente '{acc.user}'")
    return {"access_token": create_token(acc.id)}


@router.post("/logout")
def logout(_: models.Account = Depends(current_account)):
    get_logger().info("Logout effettuato")
    return {"ok": True}
