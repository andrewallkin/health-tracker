from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ...config import get_settings
from ...db_models import UserRow
from ..deps import get_current_user
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


def _user_photos_dir(user_id: str) -> Path:
    path = _photos_dir() / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def resolve_meal_photo_path(reference: str, user_id: str) -> Path | None:
    """Map a stored imageUrl or estimate photo reference to a local file path for the current user."""
    if reference.startswith("data:"):
        return None

    settings = get_settings()
    scoped_prefix = f"/api/photos/{user_id}/"
    if reference.startswith(scoped_prefix):
        filename = Path(reference.removeprefix(scoped_prefix)).name
        path = settings.meal_photos_dir / user_id / filename
        return path if path.is_file() else None

    legacy_prefix = "/api/photos/"
    if reference.startswith(legacy_prefix):
        filename = Path(reference.removeprefix(legacy_prefix)).name
        if "/" in filename:
            return None
        legacy_path = settings.meal_photos_dir / filename
        if legacy_path.is_file():
            return legacy_path
        scoped_path = settings.meal_photos_dir / user_id / filename
        return scoped_path if scoped_path.is_file() else None

    path = Path(reference)
    if path.is_file():
        return path

    return None


@router.post("", response_model=PhotoUploadResponse, status_code=201)
async def upload_photo(
    file: UploadFile = File(...),
    user: UserRow = Depends(get_current_user),
) -> PhotoUploadResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    suffix = Path(file.filename).suffix.lower()
    content_type = (file.content_type or "").lower()
    if suffix not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    ext = suffix if suffix in ALLOWED_EXTENSIONS else ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = _user_photos_dir(user.id) / filename

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    dest.write_bytes(data)
    return PhotoUploadResponse(url=f"/api/photos/{user.id}/{filename}")


@router.get("/{owner_id}/{filename}")
def get_photo(
    owner_id: str,
    filename: str,
    user: UserRow = Depends(get_current_user),
) -> FileResponse:
    if owner_id != user.id:
        raise HTTPException(status_code=404, detail="Photo not found")

    safe_name = Path(filename).name
    if safe_name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    path = _user_photos_dir(user.id) / safe_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Photo not found")

    return FileResponse(path)
