from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from backend.api.photo_storage import (
    is_gcs_object_path,
    normalize_image_url_for_storage,
    resolve_image_url_for_response,
    resolve_meal_photo_path,
    validate_check_in_photo_path,
    validate_gcs_path_for_user,
)
from backend.config import get_settings


class _MockGCS:
    def __init__(self, available: bool = True) -> None:
        self._available = available

    def is_available(self) -> bool:
        return self._available

    def generate_signed_url(self, object_path: str) -> str:
        return f"https://signed.example/{object_path}"


def test_normalize_image_url_for_storage() -> None:
    settings = get_settings()
    user_id = "user-123"
    object_path = f"{settings.gcs_meal_photos_folder}/{user_id}/meal.jpg"
    signed_url = (
        f"https://storage.googleapis.com/healthtracker_images/{object_path}"
        "?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=example"
        "&X-Goog-Date=20260629T000000Z&X-Goog-Expires=604800"
        "&X-Goog-SignedHeaders=host&X-Goog-Signature=abc123"
    )

    assert normalize_image_url_for_storage(None) is None
    assert normalize_image_url_for_storage(object_path, user_id=user_id) == object_path
    assert normalize_image_url_for_storage("/api/photos/u/p.jpg") == "/api/photos/u/p.jpg"
    assert normalize_image_url_for_storage(signed_url, user_id=user_id) == object_path


def test_is_gcs_object_path() -> None:
    assert is_gcs_object_path("meal-photos/user-id/photo.jpg")
    assert not is_gcs_object_path("/api/photos/user/photo.jpg")
    assert not is_gcs_object_path("https://example.com/photo.jpg")
    assert not is_gcs_object_path("data:image/jpeg;base64,abc")


def test_resolve_image_url_for_response() -> None:
    gcs = _MockGCS(available=True)
    assert resolve_image_url_for_response(None, gcs) is None
    assert resolve_image_url_for_response("/api/photos/u/p.jpg", gcs) == "/api/photos/u/p.jpg"
    assert resolve_image_url_for_response("https://cdn.example/p.jpg", gcs) == "https://cdn.example/p.jpg"
    assert resolve_image_url_for_response(
        "meal-photos/u/p.jpg", gcs
    ) == "https://signed.example/meal-photos/u/p.jpg"

    unavailable = _MockGCS(available=False)
    assert resolve_image_url_for_response("meal-photos/u/p.jpg", unavailable) == "meal-photos/u/p.jpg"


def test_validate_gcs_path_for_user() -> None:
    settings = get_settings()
    user_id = "user-123"
    valid = f"{settings.gcs_meal_photos_folder}/{user_id}/meal.jpg"
    validate_gcs_path_for_user(valid, user_id)

    with pytest.raises(HTTPException) as exc:
        validate_gcs_path_for_user("meal-photos/other-user/meal.jpg", user_id)
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        validate_gcs_path_for_user(f"{settings.gcs_meal_photos_folder}/{user_id}/nested/meal.jpg", user_id)
    assert exc.value.status_code == 404


def test_validate_gcs_path_for_check_in_folder() -> None:
    settings = get_settings()
    user_id = "user-123"
    valid = f"{settings.gcs_check_in_photos_folder}/{user_id}/photo.jpg"
    validate_gcs_path_for_user(valid, user_id)


def test_validate_check_in_photo_path() -> None:
    settings = get_settings()
    user_id = "user-123"
    valid = f"{settings.gcs_check_in_photos_folder}/{user_id}/photo.jpg"
    validate_check_in_photo_path(valid, user_id)

    with pytest.raises(HTTPException) as exc:
        validate_check_in_photo_path(f"{settings.gcs_meal_photos_folder}/{user_id}/meal.jpg", user_id)
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        validate_check_in_photo_path(f"/api/photos/{user_id}/photo.jpg", user_id)
    assert exc.value.status_code == 400


def test_resolve_meal_photo_path_scoped_and_legacy(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MEAL_PHOTOS_DIR", str(tmp_path))
    from backend.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()

    user_id = "user-abc"
    scoped_dir = settings.meal_photos_dir / user_id
    scoped_dir.mkdir(parents=True)
    scoped_file = scoped_dir / "scoped.jpg"
    scoped_file.write_bytes(b"jpeg")

    resolved = resolve_meal_photo_path(f"/api/photos/{user_id}/scoped.jpg", user_id)
    assert resolved == scoped_file

    legacy_file = settings.meal_photos_dir / "legacy.jpg"
    legacy_file.write_bytes(b"jpeg")
    resolved_legacy = resolve_meal_photo_path("/api/photos/legacy.jpg", user_id)
    assert resolved_legacy == legacy_file

    assert resolve_meal_photo_path("/api/photos/missing.jpg", user_id) is None
    assert resolve_meal_photo_path("data:image/jpeg;base64,abc", user_id) is None

    get_settings.cache_clear()
