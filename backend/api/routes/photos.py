from __future__ import annotations

import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from ...config import get_settings
from ...db_models import UserRow
from ...gcs import GCSService, get_gcs_service
from ..deps import get_current_user
from ..photo_storage import (
    is_gcs_object_path,
    validate_gcs_path_for_user,
)
from ..schemas import PhotoUploadResponse, SignedUrlResponse

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


def _content_type_for_ext(ext: str) -> str:
    if ext in {".png"}:
        return "image/png"
    if ext in {".webp"}:
        return "image/webp"
    if ext in {".heic", ".heif"}:
        return "image/heic"
    return "image/jpeg"


@router.post("", response_model=PhotoUploadResponse, status_code=201)
async def upload_photo(
    file: UploadFile = File(...),
    purpose: Literal["meal", "check-in"] = Query(default="meal"),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> PhotoUploadResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    suffix = Path(file.filename).suffix.lower()
    content_type = (file.content_type or "").lower()
    if suffix not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    ext = suffix if suffix in ALLOWED_EXTENSIONS else ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    settings = get_settings()

    if purpose == "check-in":
        if not gcs.is_available():
            raise HTTPException(status_code=503, detail="Photo storage is not configured")
        object_name = f"{user.id}/{filename}"
        gcs_path = gcs.upload_image(
            settings.gcs_check_in_photos_folder,
            object_name,
            data,
            _content_type_for_ext(ext),
        )
        if gcs_path is None:
            raise HTTPException(status_code=502, detail="Photo upload failed")
        signed_url = gcs.generate_signed_url(gcs_path)
        if signed_url is None:
            raise HTTPException(status_code=502, detail="Photo upload failed")
        return PhotoUploadResponse(path=gcs_path, url=signed_url)

    if gcs.is_available():
        object_name = f"{user.id}/{filename}"
        gcs_path = gcs.upload_image(
            settings.gcs_meal_photos_folder,
            object_name,
            data,
            _content_type_for_ext(ext),
        )
        if gcs_path is None:
            raise HTTPException(status_code=502, detail="Photo upload failed")
        signed_url = gcs.generate_signed_url(gcs_path)
        if signed_url is None:
            raise HTTPException(status_code=502, detail="Photo upload failed")
        return PhotoUploadResponse(path=gcs_path, url=signed_url)

    dest = _user_photos_dir(user.id) / filename
    dest.write_bytes(data)
    api_path = f"/api/photos/{user.id}/{filename}"
    return PhotoUploadResponse(path=api_path, url=api_path)


@router.get("/signed-url", response_model=SignedUrlResponse)
def get_signed_url(
    path: str = Query(..., min_length=1),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> SignedUrlResponse:
    if not is_gcs_object_path(path):
        raise HTTPException(status_code=400, detail="Invalid photo path")
    validate_gcs_path_for_user(path, user.id)
    if not gcs.is_available():
        raise HTTPException(status_code=503, detail="Photo storage is not configured")
    signed_url = gcs.generate_signed_url(path)
    if signed_url is None:
        raise HTTPException(status_code=502, detail="Could not generate photo URL")
    return SignedUrlResponse(url=signed_url)


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
