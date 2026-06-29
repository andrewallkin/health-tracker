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
    assert client.get("/api/foods").status_code == 401
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


def test_create_entry_accepts_gcs_signed_image_url(client, auth_headers):
    from backend.config import get_settings

    settings = get_settings()
    user_response = client.get("/api/users/me", headers=auth_headers)
    user_id = user_response.json()["id"]
    object_path = f"{settings.gcs_meal_photos_folder}/{user_id}/signed-meal.jpg"
    signed_url = (
        f"https://storage.googleapis.com/healthtracker_images/{object_path}"
        "?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=example"
        "&X-Goog-Date=20260629T000000Z&X-Goog-Expires=604800"
        "&X-Goog-SignedHeaders=host&X-Goog-Signature=abc123"
    )

    response = client.post(
        "/api/entries",
        headers=auth_headers,
        json={
            "logDate": "2026-06-02",
            "name": "Signed photo lunch",
            "slot": "lunch",
            "time": "13:00",
            "servings": 1,
            "calories": 600,
            "protein": 35,
            "carbs": 45,
            "fat": 25,
            "imageUrl": signed_url,
        },
    )
    assert response.status_code == 201
    assert response.json()["imageUrl"] == object_path


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


def test_saved_foods_and_composed_meals(client, auth_headers):
    mince = client.post(
        "/api/foods",
        headers=auth_headers,
        json={
            "name": "Chilli mince",
            "calories": 300,
            "protein": 25,
            "carbs": 10,
            "fat": 15,
            "tags": ["protein"],
        },
    )
    assert mince.status_code == 201
    mince_id = mince.json()["id"]

    rice = client.post(
        "/api/foods",
        headers=auth_headers,
        json={
            "name": "Rice",
            "calories": 200,
            "protein": 4,
            "carbs": 45,
            "fat": 1,
            "tags": ["carb"],
        },
    )
    assert rice.status_code == 201
    rice_id = rice.json()["id"]

    meal = client.post(
        "/api/meals",
        headers=auth_headers,
        json={
            "name": "Mince bowl",
            "items": [
                {"foodId": mince_id, "quantity": 1, "sortOrder": 0},
                {"foodId": rice_id, "quantity": 1, "sortOrder": 1},
            ],
        },
    )
    assert meal.status_code == 201
    meal_body = meal.json()
    assert meal_body["kind"] == "composed"
    assert meal_body["calories"] == 500
    assert meal_body["protein"] == 29
    assert len(meal_body["items"]) == 2
    assert meal_body["items"][0]["foodName"] == "Chilli mince"
    meal_id = meal_body["id"]

    entry = client.post(
        "/api/entries",
        headers=auth_headers,
        json={
            "logDate": "2026-06-03",
            "name": "Mince bowl",
            "slot": "dinner",
            "time": "19:00",
            "servings": 1,
            "calories": 500,
            "protein": 29,
            "carbs": 55,
            "fat": 16,
            "savedMealId": meal_id,
        },
    )
    assert entry.status_code == 201
    entry_id = entry.json()["id"]

    patch_food = client.patch(
        f"/api/foods/{mince_id}",
        headers=auth_headers,
        json={"calories": 350},
    )
    assert patch_food.status_code == 200

    meal_after = client.get("/api/meals", headers=auth_headers).json()
    composed = next(item for item in meal_after if item["id"] == meal_id)
    assert composed["calories"] == 550

    entry_before = client.get("/api/entries", headers=auth_headers, params={"date": "2026-06-03"}).json()[0]
    assert entry_before["calories"] == 500

    delete_blocked = client.delete(f"/api/foods/{rice_id}", headers=auth_headers)
    assert delete_blocked.status_code == 409
    conflict = delete_blocked.json()["detail"]
    assert meal_id in conflict["affectedMealIds"]

    delete_ok = client.delete(f"/api/foods/{rice_id}?confirm=true", headers=auth_headers)
    assert delete_ok.status_code == 204

    meals_after = client.get("/api/meals", headers=auth_headers).json()
    recomposed = next(item for item in meals_after if item["id"] == meal_id)
    assert recomposed["calories"] == 350
    assert len(recomposed["items"]) == 1

    entry_still = client.get("/api/entries", headers=auth_headers, params={"date": "2026-06-03"}).json()[0]
    assert entry_still["id"] == entry_id
    assert entry_still["calories"] == 500


def test_food_user_isolation(client):
    headers_a = register_user(client, "foods-a@example.com")
    headers_b = register_user(client, "foods-b@example.com")

    food = client.post(
        "/api/foods",
        headers=headers_a,
        json={"name": "Private", "calories": 100, "protein": 10, "carbs": 5, "fat": 2},
    )
    food_id = food.json()["id"]

    assert client.get("/api/foods", headers=headers_b).json() == []
    assert client.patch(f"/api/foods/{food_id}", headers=headers_b, json={"name": "Hacked"}).status_code == 404


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
