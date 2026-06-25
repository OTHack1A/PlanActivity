"""Account endpoints: read profile and change the login password."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import verify_password, hash_password, current_account, MASTER_ID
from ..logging_config import get_logger

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("", response_model=schemas.AccountOut)
def get_account(acc: models.Account = Depends(current_account)):
    """Return the authenticated account's username and company."""
    return schemas.AccountOut(user=acc.user, company=acc.company or "")


@router.post("/password")
def change_password(
    body: schemas.ChangePasswordIn,
    db: Session = Depends(get_db),
    acc: models.Account = Depends(current_account),
):
    """Change the login password after verifying the current one.

    The master account is virtual (no DB row), so it cannot change its password
    here — it is rotated via PIANIFICA_MASTER_HASH instead.
    """
    if acc.id == MASTER_ID:
        raise HTTPException(status_code=403, detail="L'account master non può cambiare password")
    # Verify the current password against the stored hash before allowing a change.
    if not verify_password(body.current, acc.password_hash):
        raise HTTPException(status_code=400, detail="La password attuale non è corretta")
    new_pass = body.new_password
    if not new_pass:
        raise HTTPException(status_code=422, detail="La nuova password non può essere vuota")
    # Store only the new hash; the clear password is discarded immediately.
    acc.password_hash = hash_password(new_pass)
    db.commit()
    get_logger().info(f"Password modificata: utente '{acc.user}'")
    return {"ok": True}
