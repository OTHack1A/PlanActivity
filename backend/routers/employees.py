import re
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import current_account
from ..logging_config import get_logger

router = APIRouter(prefix="/api/employees", tags=["employees"])

AVATAR_DIR = Path(__file__).parent.parent.parent / "data" / "avatars"

_ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp"}
_MEDIA_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}

_MAGIC: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff",        "jpg"),
    (b"\x89PNG\r\n\x1a\n",  "png"),
]


def _detect_image_ext(data: bytes) -> str | None:
    for sig, ext in _MAGIC:
        if data[: len(sig)] == sig:
            return ext
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


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


def _has_avatar(emp_id: str) -> bool:
    return AVATAR_DIR.exists() and any(AVATAR_DIR.glob(f"{emp_id}.*"))


def _to_out(emp: models.Employee) -> schemas.EmployeeOut:
    return schemas.EmployeeOut(
        id=emp.id,
        name=emp.name,
        role=emp.role,
        departmentId=emp.department_id,
        overtime=_overtime_str(emp.overtime_hours),
        hasAvatar=_has_avatar(emp.id),
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
    dep = db.get(models.Department, body.departmentId)
    if not dep:
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
    get_logger().info(f"Dipendente creato: '{emp.name}' (reparto: {dep.name})")
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
    changes = []
    if body.name is not None and body.name.strip() != emp.name:
        changes.append(f"nome: '{emp.name}' → '{body.name.strip()}'")
        emp.name = body.name.strip()
    if body.role is not None and body.role.strip() != emp.role:
        changes.append(f"mansione: '{emp.role}' → '{body.role.strip()}'")
        emp.role = body.role.strip()
    if body.departmentId is not None and body.departmentId != emp.department_id:
        dep = db.get(models.Department, body.departmentId)
        if not dep:
            raise HTTPException(status_code=404, detail="Reparto non trovato")
        changes.append(f"reparto → '{dep.name}'")
        emp.department_id = body.departmentId
    if body.overtime is not None:
        new_ot = _normalize_overtime(body.overtime)
        if new_ot != emp.overtime_hours:
            changes.append(f"straordinario: {_overtime_str(emp.overtime_hours) or '0'} → {_overtime_str(new_ot) or '0'} h")
            emp.overtime_hours = new_ot
    db.commit()
    db.refresh(emp)
    if changes:
        get_logger().info(f"Dipendente modificato: '{emp.name}' — {', '.join(changes)}")
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
    get_logger().info(f"Dipendente eliminato: '{emp.name}'")
    for old in AVATAR_DIR.glob(f"{emp_id}.*") if AVATAR_DIR.exists() else []:
        old.unlink(missing_ok=True)
    db.delete(emp)
    db.commit()


# --- Avatar ---

@router.post("/{emp_id}/avatar", status_code=204)
async def upload_avatar(
    emp_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    emp = db.get(models.Employee, emp_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Il file deve essere un'immagine")
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Immagine troppo grande (max 2 MB)")
    ext = _detect_image_ext(content)
    if ext is None:
        raise HTTPException(
            status_code=415,
            detail="Formato immagine non riconosciuto (usa JPG, PNG o WebP)",
        )
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    for old in AVATAR_DIR.glob(f"{emp_id}.*"):
        old.unlink(missing_ok=True)
    (AVATAR_DIR / f"{emp_id}.{ext}").write_bytes(content)
    get_logger().info(f"Avatar aggiornato: dipendente '{emp.name}'")


@router.get("/{emp_id}/avatar")
def get_avatar(emp_id: str, db: Session = Depends(get_db)):
    emp = db.get(models.Employee, emp_id)
    if not emp:
        raise HTTPException(status_code=404)
    if AVATAR_DIR.exists():
        for f in AVATAR_DIR.glob(f"{emp_id}.*"):
            return FileResponse(f, media_type=_MEDIA_TYPES.get(f.suffix[1:].lower(), "image/jpeg"))
    raise HTTPException(status_code=404, detail="Avatar non presente")


@router.delete("/{emp_id}/avatar", status_code=204)
def delete_avatar(
    emp_id: str,
    db: Session = Depends(get_db),
    _: models.Account = Depends(current_account),
):
    emp = db.get(models.Employee, emp_id)
    if not emp:
        raise HTTPException(status_code=404)
    if AVATAR_DIR.exists():
        for f in AVATAR_DIR.glob(f"{emp_id}.*"):
            f.unlink(missing_ok=True)
    get_logger().info(f"Avatar rimosso: dipendente '{emp.name}'")
