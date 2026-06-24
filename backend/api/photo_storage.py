from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import HTTPException

from ..config import get_settings
from ..gcs import GCSService


def is_gcs_object_path(reference: str) -> bool:
    """True when reference is a stored GCS object path (not a URL or API path)."""
    return (
        not reference.startswith("/")
        and not reference.startswith("data:")
        and not reference.startswith("http://")
        and not reference.startswith("https://")
    )


def resolve_image_url_for_response(
    stored: str | None,
    gcs: GCSService,
) -> str | None:
    """Map a stored image reference to a client-displayable URL."""
    if not stored:
        return None
    if stored.startswith("data:") or stored.startswith("http://") or stored.startswith("https://"):
        return stored
    if stored.startswith("/api/photos/"):
        return stored
    if is_gcs_object_path(stored) and gcs.is_available():
        return gcs.generate_signed_url(stored)
    return stored


def validate_gcs_path_for_user(object_path: str, user_id: str) -> None:
    settings = get_settings()
    prefix = f"{settings.gcs_meal_photos_folder}/{user_id}/"
    if not object_path.startswith(prefix):
        raise HTTPException(status_code=404, detail="Photo not found")
    filename = object_path.removeprefix(prefix)
    if not filename or "/" in filename or filename != Path(filename).name:
        raise HTTPException(status_code=404, detail="Photo not found")


def resolve_meal_photo_path(reference: str, user_id: str) -> Path | None:
    """Map a stored imageUrl or estimate photo reference to a local file path."""
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


def resolve_meal_photo_for_estimate(
    reference: str,
    user_id: str,
    gcs: GCSService,
) -> str | Path:
    """Resolve a photo reference to a data URL, local path, or temp file for AI estimation."""
    if reference.startswith("data:"):
        return reference

    if is_gcs_object_path(reference):
        validate_gcs_path_for_user(reference, user_id)
        if not gcs.is_available():
            raise HTTPException(status_code=503, detail="Photo storage is not configured")
        data = gcs.download_image(reference)
        if data is None:
            raise HTTPException(status_code=404, detail=f"Photo not found: {reference}")
        suffix = Path(reference).suffix or ".jpg"
        temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        temp_file.write(data)
        temp_file.close()
        return Path(temp_file.name)

    path = resolve_meal_photo_path(reference, user_id)
    if path is None:
        raise HTTPException(status_code=400, detail=f"Photo not found: {reference}")
    return path
