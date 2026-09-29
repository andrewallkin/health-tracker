from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from backend.database import get_db
from backend.db_models import CheckInPhotoRow, CheckInRow, GarminDailyHealthRow
from backend.tests.conftest import register_user
from backend.tests.test_health_api import connect_garmin, health_payload


GOAL = {"calories": 2000, "protein": 150, "carbs": 200, "fat": 70}


def issue_key(client, headers) -> str:
    response = client.post("/api/settings/external-api-key", headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["apiKey"]


def external_headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"}


def set_goal(client, headers) -> None:
    response = client.put("/api/goals", headers=headers, json=GOAL)
    assert response.status_code == 200, response.text


def db_session(client):
    gen = client.app.dependency_overrides[get_db]()
    db = next(gen)
    return db, gen


def close_db(gen) -> None:
    try:
        next(gen)
    except StopIteration:
        pass


def test_external_docs_ship_inside_the_backend_package() -> None:
    from backend.api.routes.external import _DOCS_PATH, _INFO_PATH

    backend_root = Path(__file__).resolve().parents[1]
    assert _DOCS_PATH.is_file()
    assert _INFO_PATH.is_file()
    assert _DOCS_PATH.is_relative_to(backend_root)
    assert _INFO_PATH.is_relative_to(backend_root)


def test_info_and_docs_are_public(client) -> None:
    info = client.get("/api/external/info")
    assert info.status_code == 200
    assert "text/plain" in info.headers["content-type"]
    body = info.text
    assert "POST /api/external/quick-log" in body
    assert "POST /api/external/log-food" in body
    assert "POST /api/external/meals" in body
    assert "PATCH /api/external/foods/{foodId}" in body
    assert "DELETE /api/external/foods/{foodId}" in body
    assert "PATCH /api/external/meals/{mealId}" in body
    assert "DELETE /api/external/meals/{mealId}" in body
    assert "POST /api/external/log-meal" in body
    assert "DELETE /api/external/entries/{entryId}" in body
    assert "PUT /api/external/weight" in body
    assert "AI estimate" in body

    docs = client.get("/api/external/docs")
    assert docs.status_code == 200
    assert "text/markdown" in docs.headers["content-type"]
    assert "Authorization: Bearer ht_" in docs.text


def test_external_routes_reject_missing_and_jwt_credentials(client, auth_headers) -> None:
    assert client.get("/api/external/foods").status_code == 401
    jwt_response = client.get("/api/external/foods", headers=auth_headers)
    assert jwt_response.status_code == 401
    assert client.get("/api/external/estimate", headers=auth_headers).status_code == 404


def test_generate_revoke_and_rotate_external_api_key(client, auth_headers) -> None:
    missing = client.get("/api/settings/external-api-key", headers=auth_headers)
    assert missing.status_code == 200
    assert missing.json()["hasKey"] is False

    created = client.post("/api/settings/external-api-key", headers=auth_headers)
    assert created.status_code == 201
    api_key = created.json()["apiKey"]
    assert api_key.startswith("ht_")
    assert created.json()["prefix"] == api_key[:12]

    status = client.get("/api/settings/external-api-key", headers=auth_headers)
    assert status.json()["hasKey"] is True
    assert status.json()["prefix"] == api_key[:12]
    assert "apiKey" not in status.json()

    foods = client.get("/api/external/foods", headers=external_headers(api_key))
    assert foods.status_code == 200
    assert foods.json() == []

    revoked = client.delete("/api/settings/external-api-key", headers=auth_headers)
    assert revoked.status_code == 204
    assert client.get("/api/external/foods", headers=external_headers(api_key)).status_code == 401

    rotated = issue_key(client, auth_headers)
    assert client.get("/api/external/foods", headers=external_headers(api_key)).status_code == 401
    assert client.get("/api/external/foods", headers=external_headers(rotated)).status_code == 200


def test_food_and_meal_search_is_compact(client, auth_headers) -> None:
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    created = client.post(
        "/api/external/foods",
        headers=headers,
        json={
            "name": "  Chicken breast  ",
            "description": "grilled",
            "calories": 165,
            "protein": 31,
            "carbs": 0,
            "fat": 3.6,
        },
    )
    assert created.status_code == 201, created.text
    food = created.json()
    assert food["name"] == "Chicken breast"
    assert food["description"] == "grilled"
    assert "imageUrl" not in food
    assert food["calories"] == 165

    other = client.post(
        "/api/foods",
        headers=auth_headers,
        json={"name": "Rice", "calories": 200, "protein": 4, "carbs": 45, "fat": 0.5},
    )
    assert other.status_code == 201, other.text

    listed = client.get("/api/external/foods", headers=headers, params={"q": "CHICK"})
    assert listed.status_code == 200
    assert [item["name"] for item in listed.json()] == ["Chicken breast"]
    assert listed.json()[0]["description"] == "grilled"
    assert "imageUrl" not in listed.json()[0]

    meal = client.post(
        "/api/meals",
        headers=auth_headers,
        json={
            "name": "Chicken bowl",
            "calories": 500,
            "protein": 40,
            "carbs": 50,
            "fat": 12,
            "items": [{"foodId": food["id"], "quantity": 1, "sortOrder": 0}],
        },
    )
    assert meal.status_code == 201, meal.text
    meals = client.get("/api/external/meals", headers=headers, params={"q": "bowl"})
    assert meals.status_code == 200
    body = meals.json()
    assert len(body) == 1
    assert body[0]["name"] == "Chicken bowl"
    assert body[0]["description"] is None
    assert "imageUrl" not in body[0]
    assert body[0]["items"] == [
        {"foodId": food["id"], "foodName": "Chicken breast", "quantity": 1}
    ]


def test_manual_meal_create_saves_description_and_does_not_log(client, auth_headers) -> None:
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    created = client.post(
        "/api/external/meals",
        headers=headers,
        json={
            "name": "  Restaurant pasta  ",
            "description": "estimated from the menu",
            "calories": 700,
            "protein": 25,
            "carbs": 80,
            "fat": 28,
        },
    )
    assert created.status_code == 201, created.text
    meal = created.json()
    assert meal["name"] == "Restaurant pasta"
    assert meal["description"] == "estimated from the menu"
    assert meal["calories"] == 700
    assert meal["protein"] == 25
    assert meal["items"] == []
    assert "imageUrl" not in meal

    listed = client.get("/api/external/meals", headers=headers).json()
    assert listed[0]["id"] == meal["id"]
    assert listed[0]["description"] == "estimated from the menu"
    assert client.get("/api/entries", headers=auth_headers).json() == []

    missing_macros = client.post(
        "/api/external/meals",
        headers=headers,
        json={"name": "Incomplete", "calories": 100},
    )
    assert missing_macros.status_code == 422


def test_composed_meal_create_uses_a_portion_of_each_food(client, auth_headers) -> None:
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    chicken = client.post(
        "/api/external/foods",
        headers=headers,
        json={"name": "Chicken", "description": "grilled", "calories": 100, "protein": 10, "carbs": 20, "fat": 4},
    ).json()
    rice = client.post(
        "/api/external/foods",
        headers=headers,
        json={"name": "Rice", "calories": 80, "protein": 2, "carbs": 16, "fat": 2},
    ).json()

    created = client.post(
        "/api/external/meals",
        headers=headers,
        json={
            "name": "Chicken bowl",
            "description": "lunch combo",
            "items": [
                {"foodId": chicken["id"], "quantity": 1.5},
                {"foodId": rice["id"], "quantity": 0.5},
            ],
        },
    )
    assert created.status_code == 201, created.text
    meal = created.json()
    assert meal["description"] == "lunch combo"
    assert meal["calories"] == 190
    assert meal["protein"] == 16
    assert meal["carbs"] == 38
    assert meal["fat"] == 7
    assert meal["items"] == [
        {"foodId": chicken["id"], "foodName": "Chicken", "quantity": 1.5},
        {"foodId": rice["id"], "foodName": "Rice", "quantity": 0.5},
    ]

    duplicate = client.post(
        "/api/external/meals",
        headers=headers,
        json={
            "name": "Double chicken",
            "items": [
                {"foodId": chicken["id"], "quantity": 1},
                {"foodId": chicken["id"], "quantity": 0.5},
            ],
        },
    )
    assert duplicate.status_code == 400

    missing_food = client.post(
        "/api/external/meals",
        headers=headers,
        json={"name": "Ghost", "items": [{"foodId": str(uuid.uuid4()), "quantity": 1}]},
    )
    assert missing_food.status_code == 404

    other_headers = register_user(client, "meal-other@example.com")
    other_key = issue_key(client, other_headers)
    foreign = client.post(
        "/api/external/meals",
        headers=external_headers(other_key),
        json={"name": "Stolen", "items": [{"foodId": chicken["id"], "quantity": 1}]},
    )
    assert foreign.status_code == 404


def test_log_meal_scales_saved_macros(client, auth_headers) -> None:
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    meal = client.post(
        "/api/external/meals",
        headers=headers,
        json={
            "name": "Oats",
            "description": "with milk",
            "calories": 300,
            "protein": 12,
            "carbs": 40,
            "fat": 8,
        },
    ).json()

    logged = client.post(
        "/api/external/log-meal",
        headers=headers,
        json={"mealId": meal["id"], "servings": 1.5, "slot": "breakfast", "date": "2026-09-20"},
    )
    assert logged.status_code == 201, logged.text
    body = logged.json()
    assert body["name"] == "Oats"
    assert body["servings"] == 1.5
    assert body["calories"] == 450
    assert body["protein"] == 18
    assert body["carbs"] == 60
    assert body["fat"] == 12
    assert body["slot"] == "breakfast"
    assert body["logDate"] == "2026-09-20"

    entries = client.get("/api/entries", headers=auth_headers, params={"date": "2026-09-20"})
    assert entries.status_code == 200, entries.text
    assert entries.json()[0]["savedMealId"] == meal["id"]

    missing = client.post(
        "/api/external/log-meal",
        headers=headers,
        json={"mealId": str(uuid.uuid4()), "servings": 1, "slot": "lunch"},
    )
    assert missing.status_code == 404

    other_headers = register_user(client, "log-meal-other@example.com")
    other_key = issue_key(client, other_headers)
    foreign = client.post(
        "/api/external/log-meal",
        headers=external_headers(other_key),
        json={"mealId": meal["id"], "servings": 1, "slot": "lunch", "date": "2026-09-20"},
    )
    assert foreign.status_code == 404


def test_quick_log_does_not_save_a_food_and_log_food_scales_saved_macros(client, auth_headers) -> None:
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    food = client.post(
        "/api/external/foods",
        headers=headers,
        json={"name": "Yogurt", "calories": 100, "protein": 2.5, "carbs": 12, "fat": 0},
    ).json()

    quick = client.post(
        "/api/external/quick-log",
        headers=headers,
        json={
            "name": "Estimated toast",
            "slot": "breakfast",
            "calories": 220,
            "protein": 6,
            "carbs": 30,
            "fat": 8,
            "date": "2026-09-20",
        },
    )
    assert quick.status_code == 201, quick.text
    logged = quick.json()
    assert logged["servings"] == 1
    assert logged["calories"] == 220
    assert logged["slot"] == "breakfast"
    assert logged["logDate"] == "2026-09-20"
    assert logged["time"]

    foods = client.get("/api/external/foods", headers=headers).json()
    assert [item["name"] for item in foods] == ["Yogurt"]

    scaled = client.post(
        "/api/external/log-food",
        headers=headers,
        json={"foodId": food["id"], "servings": 1, "slot": "snack", "date": "2026-09-20"},
    )
    assert scaled.status_code == 201, scaled.text
    assert scaled.json()["name"] == "Yogurt"
    assert scaled.json()["calories"] == 100
    assert scaled.json()["protein"] == 3

    half = client.post(
        "/api/external/log-food",
        headers=headers,
        json={"foodId": food["id"], "servings": 0.5, "slot": "snack", "date": "2026-09-20"},
    )
    assert half.status_code == 201, half.text
    assert half.json()["calories"] == 50
    assert half.json()["servings"] == 0.5

    missing = client.post(
        "/api/external/log-food",
        headers=headers,
        json={"foodId": str(uuid.uuid4()), "servings": 1, "slot": "lunch"},
    )
    assert missing.status_code == 404

    other_headers = register_user(client, "other@example.com")
    other_key = issue_key(client, other_headers)
    foreign = client.post(
        "/api/external/log-food",
        headers=external_headers(other_key),
        json={"foodId": food["id"], "servings": 1, "slot": "lunch", "date": "2026-09-20"},
    )
    assert foreign.status_code == 404

    future = client.post(
        "/api/external/quick-log",
        headers=headers,
        json={
            "name": "Tomorrow",
            "slot": "dinner",
            "calories": 1,
            "protein": 0,
            "carbs": 0,
            "fat": 0,
            "date": "2099-01-01",
        },
    )
    assert future.status_code == 400


def test_delete_entry_is_owner_scoped(client, auth_headers) -> None:
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    created = client.post(
        "/api/external/quick-log",
        headers=headers,
        json={
            "name": "Apple",
            "slot": "snack",
            "calories": 80,
            "protein": 0,
            "carbs": 20,
            "fat": 0,
            "date": "2026-09-20",
        },
    )
    entry_id = created.json()["id"]
    other_headers = register_user(client, "deleter@example.com")
    other_key = issue_key(client, other_headers)
    denied = client.delete(
        f"/api/external/entries/{entry_id}",
        headers=external_headers(other_key),
    )
    assert denied.status_code == 404
    deleted = client.delete(f"/api/external/entries/{entry_id}", headers=headers)
    assert deleted.status_code == 204
    assert client.delete(f"/api/external/entries/{entry_id}", headers=headers).status_code == 404


def test_today_remaining_macros_and_disconnected_health(client, auth_headers) -> None:
    set_goal(client, auth_headers)
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    client.post(
        "/api/external/quick-log",
        headers=headers,
        json={
            "name": "Lunch",
            "slot": "lunch",
            "calories": 500,
            "protein": 40,
            "carbs": 50,
            "fat": 10,
            "date": "2026-09-20",
        },
    )
    missing_goal = register_user(client, "nogoal@example.com")
    no_goal_key = issue_key(client, missing_goal)
    no_goal = client.get(
        "/api/external/today",
        headers=external_headers(no_goal_key),
        params={"date": "2026-09-20"},
    )
    assert no_goal.status_code == 404
    assert no_goal.json()["detail"] == "Daily goal is not configured"

    today = client.get("/api/external/today", headers=headers, params={"date": "2026-09-20"})
    assert today.status_code == 200, today.text
    body = today.json()
    assert body["eaten"] == {"calories": 500, "protein": 40, "carbs": 50, "fat": 10}
    assert body["remaining"]["calories"] == 1500
    assert body["remaining"]["protein"] == 110
    assert body["entries"][0]["name"] == "Lunch"
    assert body["notTracked"] is False
    assert body["weightKg"] is None
    assert body["health"]["status"] == "unavailable"
    assert body["health"]["reason"] == "disconnected"
    assert "totalCalories" not in body["health"]

    marked = client.put(
        "/api/day-statuses",
        headers=auth_headers,
        json={"statusDate": "2026-09-20"},
    )
    assert marked.status_code == 200, marked.text
    tracked = client.get("/api/external/today", headers=headers, params={"date": "2026-09-20"})
    assert tracked.json()["notTracked"] is True


def test_week_averages_skip_empty_and_untracked_days_and_pair_burn(
    client, auth_headers, monkeypatch
) -> None:
    def fake_build_fetch_day(_settings_row):
        def fetch_day(date_str: str) -> dict:
            raise RuntimeError(f"no cached garmin day for {date_str}")

        return fetch_day, lambda _db, _row: None

    monkeypatch.setattr(
        "backend.api.external_service.build_fetch_day",
        fake_build_fetch_day,
    )

    set_goal(client, auth_headers)
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    user_id = client.get("/api/users/me", headers=auth_headers).json()["id"]

    def log(name: str, day: str, calories: int) -> None:
        response = client.post(
            "/api/external/quick-log",
            headers=headers,
            json={
                "name": name,
                "slot": "dinner",
                "calories": calories,
                "protein": 10,
                "carbs": 10,
                "fat": 10,
                "date": day,
            },
        )
        assert response.status_code == 201, response.text

    log("Mon", "2026-09-21", 1500)
    log("Tue", "2026-09-22", 1000)
    log("Wed", "2026-09-23", 2500)
    skipped = client.put(
        "/api/day-statuses",
        headers=auth_headers,
        json={"statusDate": "2026-09-22"},
    )
    assert skipped.status_code == 200, skipped.text

    connect_garmin(client, auth_headers)
    db, gen = db_session(client)
    try:
        db.add(
            GarminDailyHealthRow(
                user_id=user_id,
                date="2026-09-21",
                payload=health_payload("2026-09-21", steps=1000),
                fetched_at=datetime.utcnow(),
                is_complete=True,
            )
        )
        db.commit()
    finally:
        db.close()
        close_db(gen)

    week = client.get("/api/external/week", headers=headers, params={"date": "2026-09-21"})
    assert week.status_code == 200, week.text
    body = week.json()
    assert body["startDate"] == "2026-09-21"
    assert body["endDate"] == "2026-09-27"
    assert body["nutrition"]["daysLogged"] == 2
    assert body["nutrition"]["daysOnTarget"] == 1
    assert body["nutrition"]["averages"]["calories"] == 2000
    assert body["energy"]["status"] == "ready"
    assert body["energy"]["daysUsed"] == 1
    assert body["energy"]["averageEaten"] == 1500
    assert body["energy"]["averageBurned"] == 2100
    assert body["energy"]["averageNet"] == 1500 - 2100

    month = client.get(
        "/api/external/month",
        headers=headers,
        params={"year": 2026, "month": 9},
    )
    assert month.status_code == 200, month.text
    assert month.json()["nutrition"]["daysLogged"] == 2
    assert month.json()["energy"]["daysUsed"] == 1


def test_today_returns_cached_burn_and_activities(client, auth_headers) -> None:
    set_goal(client, auth_headers)
    api_key = issue_key(client, auth_headers)
    user_id = client.get("/api/users/me", headers=auth_headers).json()["id"]
    connect_garmin(client, auth_headers)
    payload = health_payload("2026-09-21")
    payload["activities"] = [
        {
            "id": "act-1",
            "name": "Run",
            "type": "running",
            "startTime": "07:00",
            "durationMin": 30,
            "calories": 280,
            "avgHr": 150,
            "distanceKm": 5.0,
        }
    ]
    db, gen = db_session(client)
    try:
        db.add(
            GarminDailyHealthRow(
                user_id=user_id,
                date="2026-09-21",
                payload=payload,
                fetched_at=datetime.utcnow(),
                is_complete=True,
            )
        )
        db.commit()
    finally:
        db.close()
        close_db(gen)

    response = client.get(
        "/api/external/today",
        headers=external_headers(api_key),
        params={"date": "2026-09-21"},
    )
    assert response.status_code == 200, response.text
    health = response.json()["health"]
    assert health["status"] == "ready"
    assert health["totalCalories"] == 2100
    assert health["activeCalories"] == 400
    assert health["bmrCalories"] == 1700
    assert "reason" not in health
    assert health["activities"] == [
        {
            "id": "act-1",
            "name": "Run",
            "type": "running",
            "startTime": "07:00",
            "durationMin": 30,
            "calories": 280,
            "distanceKm": 5.0,
        }
    ]


def test_weight_put_keeps_notes_and_photos_and_reports_averages(client, auth_headers) -> None:
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    user_id = client.get("/api/users/me", headers=auth_headers).json()["id"]
    created = client.put(
        "/api/check-ins",
        headers=auth_headers,
        json={"checkInDate": "2026-09-25", "weightKg": 81, "notes": "keep me", "photoPaths": []},
    )
    assert created.status_code == 200, created.text
    check_in_id = created.json()["id"]

    db, gen = db_session(client)
    try:
        db.add(
            CheckInPhotoRow(
                id=str(uuid.uuid4()),
                check_in_id=check_in_id,
                image_url="users/test/check-ins/photo.jpg",
                sort_order=0,
            )
        )
        db.commit()
    finally:
        db.close()
        close_db(gen)

    updated = client.put(
        "/api/external/weight",
        headers=headers,
        json={"date": "2026-09-28", "weightKg": 80},
    )
    assert updated.status_code == 200, updated.text

    earlier = client.put(
        "/api/external/weight",
        headers=headers,
        json={"date": "2026-09-25", "weightKg": 81},
    )
    assert earlier.status_code == 200, earlier.text
    check_in = client.get("/api/check-ins", headers=auth_headers, params={"date": "2026-09-25"})
    assert check_in.json()["weightKg"] == 81
    assert check_in.json()["notes"] == "keep me"
    assert len(check_in.json()["photos"]) == 1

    snapshot = client.get("/api/external/weight", headers=headers, params={"date": "2026-09-28"})
    assert snapshot.status_code == 200, snapshot.text
    body = snapshot.json()
    assert body["weightKg"] == 80
    assert body["sevenDayAverage"]["sampleCount"] == 2
    assert body["sevenDayAverage"]["averageKg"] == 80.5
    assert len(body["series7"]) == 7
    assert len(body["series30"]) == 30
    seven_day = next(delta for delta in body["deltas"] if delta and delta["periodDays"] == 7)
    assert seven_day["label"] == "3 days"
    assert seven_day["deltaKg"] == -0.5
    assert seven_day["startDate"] == "2026-09-25"
    assert seven_day["endDate"] == "2026-09-28"

    too_light = client.put(
        "/api/external/weight",
        headers=headers,
        json={"date": "2026-09-28", "weightKg": 29},
    )
    assert too_light.status_code == 400
    future = client.get("/api/external/weight", headers=headers, params={"date": "2099-01-01"})
    assert future.status_code == 400


def _save_food(client, headers, name: str, calories: int, protein: float = 10, carbs: float = 0, fat: float = 1) -> dict:
    response = client.post(
        "/api/external/foods",
        headers=headers,
        json={
            "name": name,
            "description": f"{name} notes",
            "calories": calories,
            "protein": protein,
            "carbs": carbs,
            "fat": fat,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_update_and_delete_food(client, auth_headers) -> None:
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    chicken = _save_food(client, headers, "Chicken", 100, protein=20, carbs=0, fat=2)
    rice = _save_food(client, headers, "Rice", 80, protein=2, carbs=18, fat=0)

    meal = client.post(
        "/api/external/meals",
        headers=headers,
        json={
            "name": "Bowl",
            "items": [
                {"foodId": chicken["id"], "quantity": 1},
                {"foodId": rice["id"], "quantity": 1},
            ],
        },
    )
    assert meal.status_code == 201, meal.text
    meal_id = meal.json()["id"]
    assert meal.json()["kind"] == "composed"
    assert meal.json()["calories"] == 180

    logged = client.post(
        "/api/external/log-food",
        headers=headers,
        json={"foodId": chicken["id"], "servings": 1, "slot": "lunch", "date": "2026-09-20"},
    )
    assert logged.status_code == 201, logged.text
    entry_id = logged.json()["id"]

    updated = client.patch(
        f"/api/external/foods/{chicken['id']}",
        headers=headers,
        json={"description": "grilled", "calories": 150},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Chicken"
    assert updated.json()["description"] == "grilled"
    assert updated.json()["calories"] == 150
    assert updated.json()["protein"] == 20

    meals = client.get("/api/external/meals", headers=headers).json()
    bowl = next(item for item in meals if item["id"] == meal_id)
    assert bowl["calories"] == 230

    entry = client.get("/api/entries", headers=auth_headers, params={"date": "2026-09-20"}).json()[0]
    assert entry["id"] == entry_id
    assert entry["calories"] == 100

    cleared = client.patch(
        f"/api/external/foods/{chicken['id']}",
        headers=headers,
        json={"description": None},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["description"] is None
    assert cleared.json()["calories"] == 150

    blocked = client.delete(f"/api/external/foods/{rice['id']}", headers=headers)
    assert blocked.status_code == 409
    conflict = blocked.json()["detail"]
    assert conflict["affectedMealIds"] == [meal_id]
    assert conflict["affectedMealNames"] == ["Bowl"]

    removed = client.delete(f"/api/external/foods/{rice['id']}?confirm=true", headers=headers)
    assert removed.status_code == 204
    meals_after = client.get("/api/external/meals", headers=headers).json()
    bowl_after = next(item for item in meals_after if item["id"] == meal_id)
    assert bowl_after["calories"] == 150
    assert bowl_after["items"] == [{"foodId": chicken["id"], "foodName": "Chicken", "quantity": 1}]

    only = client.delete(f"/api/external/foods/{chicken['id']}?confirm=true", headers=headers)
    assert only.status_code == 204
    assert client.get("/api/external/meals", headers=headers).json() == []
    assert client.get("/api/external/foods", headers=headers).json() == []
    still_logged = client.get("/api/entries", headers=auth_headers, params={"date": "2026-09-20"}).json()[0]
    assert still_logged["calories"] == 100

    missing = client.delete(f"/api/external/foods/{uuid.uuid4()}", headers=headers)
    assert missing.status_code == 404
    other_headers = register_user(client, "food-edit-other@example.com")
    other_key = issue_key(client, other_headers)
    foreign_food = _save_food(client, external_headers(other_key), "Other", 50)
    foreign_patch = client.patch(
        f"/api/external/foods/{foreign_food['id']}",
        headers=headers,
        json={"calories": 60},
    )
    assert foreign_patch.status_code == 404
    foreign_delete = client.delete(f"/api/external/foods/{foreign_food['id']}", headers=headers)
    assert foreign_delete.status_code == 404


def test_update_and_delete_manual_and_composed_meals(client, auth_headers) -> None:
    api_key = issue_key(client, auth_headers)
    headers = external_headers(api_key)
    manual = client.post(
        "/api/external/meals",
        headers=headers,
        json={
            "name": "Pasta",
            "description": "restaurant",
            "calories": 700,
            "protein": 25,
            "carbs": 80,
            "fat": 28,
        },
    )
    assert manual.status_code == 201, manual.text
    manual_body = manual.json()
    assert manual_body["kind"] == "manual"
    manual_id = manual_body["id"]

    patched = client.patch(
        f"/api/external/meals/{manual_id}",
        headers=headers,
        json={"description": "updated estimate", "calories": 650, "name": "  Pasta bowl  "},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["name"] == "Pasta bowl"
    assert patched.json()["description"] == "updated estimate"
    assert patched.json()["calories"] == 650
    assert patched.json()["protein"] == 25
    assert patched.json()["kind"] == "manual"

    rejected_items = client.patch(
        f"/api/external/meals/{manual_id}",
        headers=headers,
        json={"items": [{"foodId": str(uuid.uuid4()), "quantity": 1}]},
    )
    assert rejected_items.status_code == 422

    chicken = _save_food(client, headers, "Chicken", 100, protein=20, carbs=1, fat=2)
    rice = _save_food(client, headers, "Rice", 80, protein=2, carbs=16, fat=1)
    composed = client.post(
        "/api/external/meals",
        headers=headers,
        json={
            "name": "Chicken rice",
            "description": "lunch",
            "items": [
                {"foodId": chicken["id"], "quantity": 1},
                {"foodId": rice["id"], "quantity": 1},
            ],
        },
    )
    assert composed.status_code == 201, composed.text
    composed_id = composed.json()["id"]
    assert composed.json()["calories"] == 180

    logged = client.post(
        "/api/external/log-meal",
        headers=headers,
        json={"mealId": composed_id, "servings": 1, "slot": "dinner", "date": "2026-09-21"},
    )
    assert logged.status_code == 201, logged.text

    changed = client.patch(
        f"/api/external/meals/{composed_id}",
        headers=headers,
        json={
            "description": "bigger rice",
            "items": [
                {"foodId": chicken["id"], "quantity": 1},
                {"foodId": rice["id"], "quantity": 2},
            ],
        },
    )
    assert changed.status_code == 200, changed.text
    body = changed.json()
    assert body["description"] == "bigger rice"
    assert body["kind"] == "composed"
    assert body["calories"] == 260
    assert body["items"] == [
        {"foodId": chicken["id"], "foodName": "Chicken", "quantity": 1},
        {"foodId": rice["id"], "foodName": "Rice", "quantity": 2},
    ]
    entry = client.get("/api/entries", headers=auth_headers, params={"date": "2026-09-21"}).json()[0]
    assert entry["calories"] == 180
    assert entry["savedMealId"] == composed_id

    macros_rejected = client.patch(
        f"/api/external/meals/{composed_id}",
        headers=headers,
        json={"calories": 100},
    )
    assert macros_rejected.status_code == 422

    duplicate = client.patch(
        f"/api/external/meals/{composed_id}",
        headers=headers,
        json={
            "items": [
                {"foodId": chicken["id"], "quantity": 1},
                {"foodId": chicken["id"], "quantity": 0.5},
            ]
        },
    )
    assert duplicate.status_code == 400
    unchanged = next(
        item for item in client.get("/api/external/meals", headers=headers).json() if item["id"] == composed_id
    )
    assert unchanged["calories"] == 260

    missing_food = client.patch(
        f"/api/external/meals/{composed_id}",
        headers=headers,
        json={"items": [{"foodId": str(uuid.uuid4()), "quantity": 1}]},
    )
    assert missing_food.status_code == 404

    deleted = client.delete(f"/api/external/meals/{composed_id}", headers=headers)
    assert deleted.status_code == 204
    entry_after = client.get("/api/entries", headers=auth_headers, params={"date": "2026-09-21"}).json()[0]
    assert entry_after["calories"] == 180
    assert entry_after["savedMealId"] is None
    assert client.delete(f"/api/external/meals/{composed_id}", headers=headers).status_code == 404

    other_headers = register_user(client, "meal-edit-other@example.com")
    other_key = issue_key(client, other_headers)
    foreign = client.patch(
        f"/api/external/meals/{manual_id}",
        headers=external_headers(other_key),
        json={"calories": 100},
    )
    assert foreign.status_code == 404
    assert client.delete(f"/api/external/meals/{manual_id}", headers=external_headers(other_key)).status_code == 404
    still = client.get("/api/external/meals", headers=headers).json()
    pasta = next(item for item in still if item["id"] == manual_id)
    assert pasta["calories"] == 650
