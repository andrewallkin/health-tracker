from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend.config import get_settings
from backend.gcs import get_gcs_service, reset_gcs_service
from backend.main import app
from backend.tests.conftest import register_user


class _MockGCS:
    def __init__(self) -> None:
        self._available = True

    def is_available(self) -> bool:
        return self._available

    def upload_image(self, folder: str, object_name: str, data: bytes, content_type: str) -> str:
        return f"{folder}/{object_name}"

    def generate_signed_url(self, object_path: str, expiration_days: int = 7) -> str:
        return f"https://signed.example/{object_path}"


@pytest.fixture()
def mock_gcs():
    mock = _MockGCS()
    app.dependency_overrides[get_gcs_service] = lambda: mock
    yield mock
    app.dependency_overrides.pop(get_gcs_service, None)
    reset_gcs_service()


def _user_id(client: TestClient, auth_headers: dict[str, str]) -> str:
    response = client.get("/api/users/me", headers=auth_headers)
    assert response.status_code == 200
    return response.json()["id"]


def _check_in_photo_path(user_id: str, filename: str = "photo.jpg") -> str:
    settings = get_settings()
    return f"{settings.gcs_check_in_photos_folder}/{user_id}/{filename}"


def test_upsert_weight_only(client: TestClient, auth_headers: dict[str, str], mock_gcs: _MockGCS) -> None:
    today = date.today().isoformat()
    response = client.put(
        "/api/check-ins",
        headers=auth_headers,
        json={"checkInDate": today, "weightKg": 82.5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["checkInDate"] == today
    assert body["weightKg"] == 82.5
    assert body["photos"] == []


def test_upsert_photos_only(
    client: TestClient, auth_headers: dict[str, str], mock_gcs: _MockGCS
) -> None:
    user_id = _user_id(client, auth_headers)
    today = date.today().isoformat()
    photo_path = _check_in_photo_path(user_id)
    response = client.put(
        "/api/check-ins",
        headers=auth_headers,
        json={"checkInDate": today, "photoPaths": [photo_path]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["weightKg"] is None
    assert len(body["photos"]) == 1
    assert body["photos"][0]["imageUrl"].startswith("https://signed.example/")


def test_upsert_both_and_update(
    client: TestClient, auth_headers: dict[str, str], mock_gcs: _MockGCS
) -> None:
    user_id = _user_id(client, auth_headers)
    today = date.today().isoformat()
    photo_path = _check_in_photo_path(user_id)

    create = client.put(
        "/api/check-ins",
        headers=auth_headers,
        json={"checkInDate": today, "weightKg": 80.0, "photoPaths": [photo_path]},
    )
    assert create.status_code == 200
    check_in_id = create.json()["id"]

    update = client.put(
        "/api/check-ins",
        headers=auth_headers,
        json={"checkInDate": today, "weightKg": 79.5, "photoPaths": []},
    )
    assert update.status_code == 200
    assert update.json()["id"] == check_in_id
    assert update.json()["weightKg"] == 79.5
    assert update.json()["photos"] == []


def test_reject_empty_upsert(client: TestClient, auth_headers: dict[str, str], mock_gcs: _MockGCS) -> None:
    today = date.today().isoformat()
    response = client.put(
        "/api/check-ins",
        headers=auth_headers,
        json={"checkInDate": today},
    )
    assert response.status_code == 400


def test_reject_invalid_photo_path(
    client: TestClient, auth_headers: dict[str, str], mock_gcs: _MockGCS
) -> None:
    user_id = _user_id(client, auth_headers)
    settings = get_settings()
    today = date.today().isoformat()
    meal_path = f"{settings.gcs_meal_photos_folder}/{user_id}/meal.jpg"
    local_path = f"/api/photos/{user_id}/meal.jpg"

    for bad_path in [meal_path, local_path, "not-a-path"]:
        response = client.put(
            "/api/check-ins",
            headers=auth_headers,
            json={"checkInDate": today, "photoPaths": [bad_path]},
        )
        assert response.status_code in {400, 404}


def test_get_by_date_and_range(
    client: TestClient, auth_headers: dict[str, str], mock_gcs: _MockGCS
) -> None:
    today = date.today().isoformat()
    client.put(
        "/api/check-ins",
        headers=auth_headers,
        json={"checkInDate": today, "weightKg": 81.0},
    )

    single = client.get("/api/check-ins", headers=auth_headers, params={"date": today})
    assert single.status_code == 200
    assert single.json()["weightKg"] == 81.0

    missing = client.get("/api/check-ins", headers=auth_headers, params={"date": "2020-01-01"})
    assert missing.status_code == 200
    assert missing.json() is None

    ranged = client.get(
        "/api/check-ins",
        headers=auth_headers,
        params={"from": today, "to": today},
    )
    assert ranged.status_code == 200
    assert len(ranged.json()) == 1


def test_delete_check_in(client: TestClient, auth_headers: dict[str, str], mock_gcs: _MockGCS) -> None:
    today = date.today().isoformat()
    created = client.put(
        "/api/check-ins",
        headers=auth_headers,
        json={"checkInDate": today, "weightKg": 77.0},
    )
    check_in_id = created.json()["id"]

    delete = client.delete(f"/api/check-ins/{check_in_id}", headers=auth_headers)
    assert delete.status_code == 204

    fetched = client.get("/api/check-ins", headers=auth_headers, params={"date": today})
    assert fetched.json() is None


def test_check_in_photo_upload_requires_gcs(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/photos?purpose=check-in",
        headers=auth_headers,
        files={"file": ("check-in.jpg", b"fake-jpeg-bytes", "image/jpeg")},
    )
    assert response.status_code == 503


def test_check_in_photo_upload_with_gcs(
    client: TestClient, auth_headers: dict[str, str], mock_gcs: _MockGCS
) -> None:
    user_id = _user_id(client, auth_headers)
    response = client.post(
        "/api/photos?purpose=check-in",
        headers=auth_headers,
        files={"file": ("check-in.jpg", b"fake-jpeg-bytes", "image/jpeg")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["path"].startswith(f"{get_settings().gcs_check_in_photos_folder}/{user_id}/")
    assert body["url"].startswith("https://signed.example/")


def test_check_in_isolated_between_users(
    client: TestClient, mock_gcs: _MockGCS
) -> None:
    headers_a = register_user(client, "a@example.com")
    headers_b = register_user(client, "b@example.com")
    today = date.today().isoformat()

    created = client.put(
        "/api/check-ins",
        headers=headers_a,
        json={"checkInDate": today, "weightKg": 90.0},
    )
    check_in_id = created.json()["id"]

    forbidden = client.delete(f"/api/check-ins/{check_in_id}", headers=headers_b)
    assert forbidden.status_code == 404
