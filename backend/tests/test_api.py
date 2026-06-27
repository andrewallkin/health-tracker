from __future__ import annotations

from cryptography.fernet import Fernet

from backend.crypto import decrypt_api_key, encrypt_api_key, mask_api_key
from backend.tests.conftest import register_user


def test_encrypt_decrypt_round_trip(monkeypatch):
    key = Fernet.generate_key().decode()
    monkeypatch.setenv("SETTINGS_ENCRYPTION_KEY", key)

    from backend.config import get_settings

    get_settings.cache_clear()

    ciphertext = encrypt_api_key("sk-test-key-1234567890")
    assert decrypt_api_key(ciphertext) == "sk-test-key-1234567890"
    assert mask_api_key("sk-test-key-1234567890").startswith("sk-")

    get_settings.cache_clear()


def test_protected_routes_require_auth(client):
    assert client.get("/api/goals").status_code == 401
    assert client.get("/api/meals").status_code == 401
    assert client.get("/api/entries").status_code == 401
    assert client.get("/api/settings/ai").status_code == 401
    assert client.post("/api/estimate", json={"note": "shake"}).status_code == 401


def test_goals_crud(client, auth_headers):
    response = client.get("/api/goals", headers=auth_headers)
    assert response.status_code == 404

    response = client.put(
        "/api/goals",
        headers=auth_headers,
        json={"calories": 2000, "protein": 150, "carbs": 200, "fat": 65},
    )
    assert response.status_code == 200
    assert response.json()["calories"] == 2000

    response = client.get("/api/goals", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["calories"] == 2000


def test_meals_and_entries(client, auth_headers):
    meal_response = client.post(
        "/api/meals",
        headers=auth_headers,
        json={
            "name": "Test meal",
            "calories": 400,
            "protein": 30,
            "carbs": 40,
            "fat": 10,
        },
    )
    assert meal_response.status_code == 201
    meal_id = meal_response.json()["id"]

    entry_response = client.post(
        "/api/entries",
        headers=auth_headers,
        json={
            "logDate": "2026-06-01",
            "name": "Test meal",
            "slot": "lunch",
            "time": "12:00",
            "servings": 1,
            "calories": 400,
            "protein": 30,
            "carbs": 40,
            "fat": 10,
            "savedMealId": meal_id,
        },
    )
    assert entry_response.status_code == 201
    entry_id = entry_response.json()["id"]

    list_response = client.get("/api/entries", headers=auth_headers, params={"date": "2026-06-01"})
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    range_response = client.get(
        "/api/entries",
        headers=auth_headers,
        params={"from": "2026-06-01", "to": "2026-06-07"},
    )
    assert range_response.status_code == 200
    assert len(range_response.json()) == 1

    patch_response = client.patch(
        f"/api/entries/{entry_id}",
        headers=auth_headers,
        json={"servings": 2, "calories": 800},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["calories"] == 800

    delete_response = client.delete(f"/api/entries/{entry_id}", headers=auth_headers)
    assert delete_response.status_code == 204


def test_user_data_isolation(client):
    headers_a = register_user(client, "a@example.com")
    headers_b = register_user(client, "b@example.com")

    meal_response = client.post(
        "/api/meals",
        headers=headers_a,
        json={
            "name": "Private meal",
            "calories": 400,
            "protein": 30,
            "carbs": 40,
            "fat": 10,
        },
    )
    assert meal_response.status_code == 201
    meal_id = meal_response.json()["id"]

    assert client.get("/api/meals", headers=headers_b).json() == []

    patch_other_user = client.patch(
        f"/api/meals/{meal_id}",
        headers=headers_b,
        json={"name": "Hacked"},
    )
    assert patch_other_user.status_code == 404


def test_entry_image_url_and_saved_meal_fallback(client, auth_headers):
    meal_response = client.post(
        "/api/meals",
        headers=auth_headers,
        json={
            "name": "Photo meal",
            "imageUrl": "/api/photos/test-meal.jpg",
            "calories": 500,
            "protein": 30,
            "carbs": 40,
            "fat": 20,
        },
    )
    assert meal_response.status_code == 201
    meal_id = meal_response.json()["id"]

    direct_response = client.post(
        "/api/entries",
        headers=auth_headers,
        json={
            "logDate": "2026-06-02",
            "name": "AI lunch",
            "slot": "lunch",
            "time": "13:00",
            "servings": 1,
            "calories": 600,
            "protein": 35,
            "carbs": 45,
            "fat": 25,
            "imageUrl": "/api/photos/ai-lunch.jpg",
        },
    )
    assert direct_response.status_code == 201
    assert direct_response.json()["imageUrl"] == "/api/photos/ai-lunch.jpg"

    linked_response = client.post(
        "/api/entries",
        headers=auth_headers,
        json={
            "logDate": "2026-06-02",
            "name": "Photo meal",
            "slot": "dinner",
            "time": "19:00",
            "servings": 1,
            "calories": 500,
            "protein": 30,
            "carbs": 40,
            "fat": 20,
            "savedMealId": meal_id,
        },
    )
    assert linked_response.status_code == 201
    assert linked_response.json()["imageUrl"] == "/api/photos/test-meal.jpg"


def test_meal_update_and_delete(client, auth_headers):
    create_response = client.post(
        "/api/meals",
        headers=auth_headers,
        json={
            "name": "Original meal",
            "calories": 400,
            "protein": 30,
            "carbs": 40,
            "fat": 10,
        },
    )
    assert create_response.status_code == 201
    meal_id = create_response.json()["id"]

    patch_response = client.patch(
        f"/api/meals/{meal_id}",
        headers=auth_headers,
        json={"name": "Updated meal", "calories": 450},
    )
    assert patch_response.status_code == 200
    body = patch_response.json()
    assert body["name"] == "Updated meal"
    assert body["calories"] == 450

    entry_response = client.post(
        "/api/entries",
        headers=auth_headers,
        json={
            "logDate": "2026-06-02",
            "name": "Updated meal",
            "slot": "dinner",
            "time": "19:00",
            "servings": 1,
            "calories": 450,
            "protein": 30,
            "carbs": 40,
            "fat": 10,
            "savedMealId": meal_id,
        },
    )
    assert entry_response.status_code == 201
    entry_id = entry_response.json()["id"]

    delete_response = client.delete(f"/api/meals/{meal_id}", headers=auth_headers)
    assert delete_response.status_code == 204

    entry_after = client.get("/api/entries", headers=auth_headers, params={"date": "2026-06-02"}).json()[0]
    assert entry_after["id"] == entry_id
    assert entry_after["savedMealId"] is None


def test_photo_upload(client, auth_headers):
    from backend.config import get_settings

    response = client.post(
        "/api/photos",
        headers=auth_headers,
        files={"file": ("meal.jpg", b"fake-jpeg-bytes", "image/jpeg")},
    )
    assert response.status_code == 201
    body = response.json()
    path = body["path"]
    url = body["url"]
    assert path == url
    assert path.startswith("/api/photos/")

    user_id = path.split("/")[3]
    filename = path.split("/")[4]
    assert (get_settings().meal_photos_dir / user_id / filename).is_file()

    get_response = client.get(path, headers=auth_headers)
    assert get_response.status_code == 200


def test_ai_settings_and_estimate_without_key(client, auth_headers):
    estimate_response = client.post(
        "/api/estimate",
        headers=auth_headers,
        json={"note": "protein shake"},
    )
    assert estimate_response.status_code == 422

    settings_response = client.get("/api/settings/ai", headers=auth_headers)
    assert settings_response.status_code == 200
    assert settings_response.json()["hasApiKey"] is False

    models_response = client.get("/api/settings/models", headers=auth_headers)
    assert models_response.status_code == 200
    assert len(models_response.json()["models"]) >= 2

    update_response = client.put(
        "/api/settings/ai",
        headers=auth_headers,
        json={
            "apiKey": "sk-test-key-1234567890",
            "textModel": "gpt-5-nano",
            "imageModel": "gpt-5-mini",
        },
    )
    assert update_response.status_code == 200
    body = update_response.json()
    assert body["hasApiKey"] is True
    assert body["textModel"] == "gpt-5-nano"

    clear_response = client.put(
        "/api/settings/ai",
        headers=auth_headers,
        json={
            "clearApiKey": True,
            "textModel": "gpt-5-nano",
            "imageModel": "gpt-5-mini",
        },
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["hasApiKey"] is False
