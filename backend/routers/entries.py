from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import current_account
from ..logging_config import get_logger

router = APIRouter(prefix="/api", tags=["entries"])


@router.get("/entries", response_model=schemas.EntriesOut)
def get_entries(
    from_: str = Query(..., alias="from"),
    to_: str = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    try:
        d_from = date_type.fromisoformat(from_)
        d_to = date_type.fromisoformat(to_)
    except ValueError:
        raise HTTPException(status_code=422, detail="Formato data non valido (usa YYYY-MM-DD)")

    activities = (
        db.query(models.Activity)
        .filter(models.Activity.date >= d_from, models.Activity.date <= d_to)
        .order_by(models.Activity.date, models.Activity.employee_id, models.Activity.order_index)
        .all()
    )
    absences = (
        db.query(models.Absence)
        .filter(models.Absence.date >= d_from, models.Absence.date <= d_to)
        .all()
    )

    entries: dict = {}
    for a in activities:
        ds = a.date.isoformat()
        entries.setdefault(ds, {}).setdefault(a.employee_id, []).append(
            {"id": a.id, "activity": a.activity, "hours": a.hours, "notes": a.notes}
        )

    abs_map: dict = {}
    for ab in absences:
        abs_map.setdefault(ab.date.isoformat(), {})[ab.employee_id] = ab.type

    return {"entries": entries, "absences": abs_map}


@router.put("/entries/{employee_id}/{date_str}")
def put_entries(
    employee_id: str,
    date_str: str,
    body: schemas.PutEntriesIn,
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    emp = db.get(models.Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    try:
        d = date_type.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="Formato data non valido")

    db.query(models.Activity).filter(
        models.Activity.employee_id == employee_id,
        models.Activity.date == d,
    ).delete()

    for i, item in enumerate(body.activities):
        db.add(
            models.Activity(
                id=item.id,
                employee_id=employee_id,
                date=d,
                activity=item.activity,
                hours=item.hours,
                notes=item.notes,
                order_index=i,
            )
        )

    db.commit()
    n = len(body.activities)
    total_h = sum(a.hours for a in body.activities)
    get_logger().info(
        f"Attività aggiornate: '{emp.name}' il {date_str} — {n} attività, tot {total_h:.1f} h"
    )
    return {"ok": True}


@router.put("/absences/{employee_id}/{date_str}")
def put_absence(
    employee_id: str,
    date_str: str,
    body: schemas.PutAbsenceIn,
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    emp = db.get(models.Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    try:
        d = date_type.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="Formato data non valido")

    existing = (
        db.query(models.Absence)
        .filter(models.Absence.employee_id == employee_id, models.Absence.date == d)
        .first()
    )

    if not body.type:
        if existing:
            db.delete(existing)
            get_logger().info(f"Assenza rimossa: '{emp.name}' il {date_str}")
    elif existing:
        if existing.type != body.type:
            get_logger().info(f"Assenza modificata: '{emp.name}' il {date_str} — {existing.type} → {body.type}")
        existing.type = body.type
    else:
        db.add(models.Absence(employee_id=employee_id, date=d, type=body.type))
        get_logger().info(f"Assenza impostata: '{emp.name}' il {date_str} — {body.type}")

    db.commit()
    return {"ok": True}
