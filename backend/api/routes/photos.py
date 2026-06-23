from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ...config import get_settings
from ..schemas import PhotoUploadResponse

router = APIRouter(prefix="/photos", tags=["photos"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/webp",
}


def _photos_dir() -> Path:
    settings = get_settings()
    settings.meal_photos_dir.mkdir(parents=True, exist_ok=True)
    return settings.meal_photos_dir


def resolve_meal_photo_path(reference: str) -> Path | None:
    """Map a stored imageUrl or estimate photo reference to a local file path."""
    if reference.startswith("data:"):
        return None

    settings = get_settings()
    prefix = "/api/photos/"
    if reference.startswith(prefix):
        filename = Path(reference.removeprefix(prefix)).name
        path = settings.meal_photos_dir / filename
        return path if path.is_file() else None

    path = Path(reference)
    if path.is_file():
        return path

    return None


@router.post("", response_model=PhotoUploadResponse, status_code=201)
async def upload_photo(file: UploadFile = File(...)) -> PhotoUploadResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    suffix = Path(file.filename).suffix.lower()
    content_type = (file.content_type or "").lower()
    if suffix not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    ext = suffix if suffix in ALLOWED_EXTENSIONS else ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = _photos_dir() / filename

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    dest.write_bytes(data)
    return PhotoUploadResponse(url=f"/api/photos/{filename}")
