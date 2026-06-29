from __future__ import annotations

import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse

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


def _extract_gcs_path_from_signed_url(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return None
    if parsed.netloc not in ("storage.googleapis.com", "storage.cloud.google.com"):
        return None

    settings = get_settings()
    path = unquote(parsed.path.lstrip("/"))
    if not path:
        return None

    bucket = settings.gcs_images_bucket_name
    if bucket and path.startswith(f"{bucket}/"):
        object_path = path[len(bucket) + 1 :]
        if is_gcs_object_path(object_path):
            return object_path

    for folder in (settings.gcs_meal_photos_folder, settings.gcs_check_in_photos_folder):
        marker = f"{folder}/"
        idx = path.find(marker)
        if idx >= 0:
            candidate = path[idx:]
            if is_gcs_object_path(candidate):
                return candidate

    return None


def normalize_image_url_for_storage(
    reference: str | None,
    *,
    user_id: str | None = None,
) -> str | None:
    """Convert client image references to a storable path before persisting."""
    if not reference:
        return None

    reference = reference.strip()
    if not reference:
        return None

    if is_gcs_object_path(reference):
        if user_id:
            validate_gcs_path_for_user(reference, user_id)
        return reference

    if reference.startswith("/api/photos/") or reference.startswith("data:"):
        return reference

    extracted = _extract_gcs_path_from_signed_url(reference)
    if extracted:
        if user_id:
            validate_gcs_path_for_user(extracted, user_id)
        return extracted

    if reference.startswith("http://") or reference.startswith("https://"):
        if len(reference) > 512:
            raise HTTPException(status_code=422, detail="Image URL is too long to store")
        return reference

    return reference


def _validate_gcs_folder_path(object_path: str, user_id: str, folder: str) -> None:
    prefix = f"{folder}/{user_id}/"
    if not object_path.startswith(prefix):
        raise HTTPException(status_code=404, detail="Photo not found")
    filename = object_path.removeprefix(prefix)
    if not filename or "/" in filename or filename != Path(filename).name:
        raise HTTPException(status_code=404, detail="Photo not found")


def validate_gcs_path_for_user(object_path: str, user_id: str) -> None:
    settings = get_settings()
    allowed = (settings.gcs_meal_photos_folder, settings.gcs_check_in_photos_folder)
    if not any(object_path.startswith(f"{folder}/{user_id}/") for folder in allowed):
        raise HTTPException(status_code=404, detail="Photo not found")
    for folder in allowed:
        prefix = f"{folder}/{user_id}/"
        if object_path.startswith(prefix):
            filename = object_path.removeprefix(prefix)
            if not filename or "/" in filename or filename != Path(filename).name:
                raise HTTPException(status_code=404, detail="Photo not found")
            return


def validate_check_in_photo_path(reference: str, user_id: str) -> None:
    if not is_gcs_object_path(reference):
        raise HTTPException(status_code=400, detail="Invalid check-in photo path")
    settings = get_settings()
    _validate_gcs_folder_path(reference, user_id, settings.gcs_check_in_photos_folder)


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
