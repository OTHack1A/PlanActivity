import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import current_account

router = APIRouter(prefix="/api/employees", tags=["employees"])


def _normalize_overtime(raw: str) -> float:
    if not raw:
        return 0.0
    v = re.sub(r"[^\d.]", "", raw.replace(",", "."))
    parts = v.split(".")
    if len(parts) > 1:
        v = parts[0] + "." + parts[1][:1]
    try:
        return round(float(v), 1)
    except ValueError:
        return 0.0


def _overtime_str(val: float) -> str:
    if val == 0.0:
        return ""
    s = f"{val:.1f}"
    return s.rstrip("0").rstrip(".")


def _to_out(emp: models.Employee) -> schemas.EmployeeOut:
    return schemas.EmployeeOut(
        id=emp.id,
        name=emp.name,
        role=emp.role,
        departmentId=emp.department_id,
        overtime=_overtime_str(emp.overtime_hours),
    )


@router.get("", response_model=list[schemas.EmployeeOut])
def get_employees(
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    emps = db.query(models.Employee).order_by(models.Employee.created_at).all()
    return [_to_out(e) for e in emps]


@router.post("", response_model=schemas.EmployeeOut, status_code=201)
def create_employee(
    body: schemas.EmployeeIn,
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    if not db.get(models.Department, body.departmentId):
        raise HTTPException(status_code=404, detail="Reparto non trovato")
    emp = models.Employee(
        name=body.name.strip(),
        role=body.role.strip() or "—",
        department_id=body.departmentId,
        overtime_hours=_normalize_overtime(body.overtime),
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return _to_out(emp)


@router.patch("/{emp_id}", response_model=schemas.EmployeeOut)
def patch_employee(
    emp_id: str,
    body: schemas.EmployeePatch,
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    emp = db.get(models.Employee, emp_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    if body.name is not None:
        emp.name = body.name.strip()
    if body.role is not None:
        emp.role = body.role.strip()
    if body.departmentId is not None:
        if not db.get(models.Department, body.departmentId):
            raise HTTPException(status_code=404, detail="Reparto non trovato")
        emp.department_id = body.departmentId
    if body.overtime is not None:
        emp.overtime_hours = _normalize_overtime(body.overtime)
    db.commit()
    db.refresh(emp)
    return _to_out(emp)


@router.delete("/{emp_id}", status_code=204)
def delete_employee(
    emp_id: str,
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    emp = db.get(models.Employee, emp_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    db.delete(emp)
    db.commit()
