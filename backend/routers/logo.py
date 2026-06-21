import sys
from pathlib import Path
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..logging_config import get_logger
from .._paths import DATA_DIR, RUNTIME_ROOT

router = APIRouter(prefix="/api/logo", tags=["logo"])

_DATA_DIR = DATA_DIR
_MAX_BYTES = 2 * 1024 * 1024
_ALLOWED   = {"jpg", "jpeg", "png", "webp"}

_MAGIC: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff",         "jpg"),
    (b"\x89PNG\r\n\x1a\n",   "png"),
]

_EXT_MIME = {
    "jpg":  "image/jpeg",
    "jpeg": "image/jpeg",
    "png":  "image/png",
    "webp": "image/webp",
}


def _is_webp(data: bytes) -> bool:
    return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"


def _detect_ext(data: bytes) -> str | None:
    for sig, ext in _MAGIC:
        if data[: len(sig)] == sig:
            return ext
    if _is_webp(data):
        return "webp"
    return None


def _custom_logo() -> Path | None:
    for ext in _ALLOWED:
        p = _DATA_DIR / f"logo.{ext}"
        if p.exists():
            return p
    return None


def _default_logo() -> Path | None:
    # In a frozen exe, the bundled frontend/dist is inside sys._MEIPASS.
    meipass = Path(getattr(sys, "_MEIPASS", ""))
    for candidate in (
        meipass / "frontend" / "dist" / "logo.jpg",
        RUNTIME_ROOT / "frontend" / "public" / "logo.jpg",
        RUNTIME_ROOT / "frontend" / "dist" / "logo.jpg",
    ):
        if candidate.exists():
            return candidate
    return None


@router.get("/status")
def logo_status():
    return {"customized": _custom_logo() is not None}


@router.get("", response_class=FileResponse)
def serve_logo():
    path = _custom_logo() or _default_logo()
    if path is None:
        raise HTTPException(status_code=404, detail="Logo non trovato")
    ext  = path.suffix.lstrip(".").lower()
    mime = _EXT_MIME.get(ext, "image/jpeg")
    return FileResponse(
        str(path), media_type=mime,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.post("", status_code=204)
async def upload_logo(file: UploadFile = File(...)):
    """Carica il logo personalizzato — operazione consentita una sola volta."""
    if _custom_logo():
        raise HTTPException(
            status_code=409,
            detail="Logo già impostato — non è possibile modificarlo",
        )

    ct = (file.content_type or "").lower()
    if not ct.startswith("image/"):
        raise HTTPException(status_code=415, detail="Il file deve essere un'immagine")

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(
            status_code=413, detail="Immagine troppo grande (max 2 MB)"
        )

    ext = _detect_ext(data)
    if ext is None:
        raise HTTPException(
            status_code=415,
            detail="Formato immagine non riconosciuto (usa JPG, PNG o WebP)",
        )

    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    dest = _DATA_DIR / f"logo.{ext}"
    dest.write_bytes(data)
    get_logger().info(f"Logo personalizzato caricato: {dest.name} ({len(data)} byte)")
