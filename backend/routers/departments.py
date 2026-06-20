from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import current_account
from ..logging_config import get_logger

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=list[schemas.DepartmentOut])
def get_departments(
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    return db.query(models.Department).order_by(models.Department.created_at).all()


@router.post("", response_model=schemas.DepartmentOut, status_code=201)
def create_department(
    body: schemas.DepartmentIn,
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    dep = models.Department(name=body.name.strip(), color=body.color)
    db.add(dep)
    db.commit()
    db.refresh(dep)
    get_logger().info(f"Reparto creato: '{dep.name}' (colore: {dep.color})")
    return dep


@router.delete("/{dep_id}", status_code=204)
def delete_department(
    dep_id: str,
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    dep = db.get(models.Department, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Reparto non trovato")
    n_emp = len(dep.employees)
    get_logger().info(f"Reparto eliminato: '{dep.name}' (con {n_emp} dipendenti)")
    db.delete(dep)
    db.commit()
