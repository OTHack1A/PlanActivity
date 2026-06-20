from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import hash_password, verify_password, create_token, current_account

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
    acc = models.Account(user=user, password_hash=hash_password(body.password))
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return {"access_token": create_token(acc.id)}


@router.post("/login", response_model=schemas.TokenOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    acc = (
        db.query(models.Account)
        .filter(models.Account.user.ilike(body.user.strip()))
        .first()
    )
    if not acc or not verify_password(body.password, acc.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenziali non valide",
        )
    return {"access_token": create_token(acc.id)}


@router.post("/logout")
def logout():
    return {"ok": True}
