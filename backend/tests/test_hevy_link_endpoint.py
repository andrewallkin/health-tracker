"""Tests for manual Garmin<->Hevy link management and the bulk load endpoints.

Auth uses per-user external API keys issued through the settings API; the
Hevy client is injected via the ``require_hevy_configured`` dependency
override so no network calls happen.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from backend.api.routes import external as external_routes
from backend.config import Settings
from backend.database import get_db
from backend.db_models import GarminDailyHealthRow, HevySyncStateRow, HevyWorkoutRow, UserRow
from backend.tests.conftest import register_user

LINKS_PATH = "/api/external/hevy/links"
LOAD_PATHS = {
    "templates": "/api/external/hevy/load/templates",
    "workouts": "/api/external/hevy/load/workouts",
    "events": "/api/external/hevy/load/events",
}
DATE = "2026-11-10"
ACTIVITY_ID = "24833957297"
OTHER_ACTIVITY_ID = "24833957298"


# --- helpers ----------------------------------------------------------------------


def db_session(client: TestClient):
    gen = client.app.dependency_overrides[get_db]()
    db = next(gen)
    return db, gen


def close_db(gen) -> None:
    try:
        next(gen)
    except StopIteration:
        pass


def _auth_headers(client: TestClient) -> dict[str, str]:
    headers = register_user(client, f"{uuid.uuid4()}@example.com")
    response = client.post("/api/settings/external-api-key", headers=headers)
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['apiKey']}"}


def _seed_workout(db, user_id: str, workout_id: str, *, garmin_activity_ids: list[str] | None = None):
    row = HevyWorkoutRow(
        id=workout_id,
        user_id=user_id,
        title="Push Day",
        start_time=datetime(2026, 11, 10, 14, 22, tzinfo=timezone.utc),
        end_time=datetime(2026, 11, 10, 15, 10, tzinfo=timezone.utc),
        local_date=DATE,
        garmin_activity_ids=garmin_activity_ids if garmin_activity_ids is not None else [],
        payload={"id": workout_id, "title": "Push Day", "exercises": []},
    )
    db.add(row)
    db.commit()
    return row


def _seed_garmin_day(db, user_id: str, *, date_key: str = DATE, activity_ids: tuple[str, ...] = (ACTIVITY_ID,)):
    activities = [{"id": activity_id, "startTime": "16:22"} for activity_id in activity_ids]
    row = GarminDailyHealthRow(
        user_id=user_id,
        date=date_key,
        payload={"date": date_key, "activities": activities},
        is_complete=True,
    )
    db.add(row)
    db.commit()
    return row


def _link_body(workout_id: str, activity_id: str) -> dict:
    return {"workout_id": workout_id, "garmin_activity_id": activity_id}


# --- manual link: roundtrip, conflicts, unlink, re-link ----------------------------


def test_link_then_conflicts_then_unlink_and_relink(client: TestClient) -> None:
    auth = _auth_headers(client)
    db, gen = db_session(client)
    try:
        user_id = db.query(UserRow).first().id
        _seed_workout(db, user_id, "w1")
        _seed_workout(db, user_id, "w2")
        _seed_garmin_day(db, user_id, activity_ids=(ACTIVITY_ID, OTHER_ACTIVITY_ID))
    finally:
        db.close()
        close_db(gen)

    linked = client.post(LINKS_PATH, json=_link_body("w1", ACTIVITY_ID), headers=auth)
    assert linked.status_code == 200, linked.text
    assert linked.json() == {"workout_id": "w1", "garmin_activity_ids": [ACTIVITY_ID]}

    # 1:1 from the workout side: it already has a link.
    workout_conflict = client.post(LINKS_PATH, json=_link_body("w1", OTHER_ACTIVITY_ID), headers=auth)
    assert workout_conflict.status_code == 409

    # 1:1 from the activity side: another workout already claims it.
    activity_conflict = client.post(LINKS_PATH, json=_link_body("w2", ACTIVITY_ID), headers=auth)
    assert activity_conflict.status_code == 409

    # Unlink clears the list; repeating it is 404; re-linking works afterwards.
    unlinked = client.request("DELETE", LINKS_PATH, json=_link_body("w1", ACTIVITY_ID), headers=auth)
    assert unlinked.status_code == 200, unlinked.text
    assert unlinked.json() == {"workout_id": "w1", "garmin_activity_ids": []}

    repeat = client.request("DELETE", LINKS_PATH, json=_link_body("w1", ACTIVITY_ID), headers=auth)
    assert repeat.status_code == 404

    relinked = client.post(LINKS_PATH, json=_link_body("w1", OTHER_ACTIVITY_ID), headers=auth)
    assert relinked.status_code == 200, relinked.text
    assert relinked.json() == {"workout_id": "w1", "garmin_activity_ids": [OTHER_ACTIVITY_ID]}

    db, gen = db_session(client)
    try:
        assert db.get(HevyWorkoutRow, "w1").garmin_activity_ids == [OTHER_ACTIVITY_ID]
    finally:
        db.close()
        close_db(gen)


def test_link_validates_both_sides_exist(client: TestClient) -> None:
    auth = _auth_headers(client)
    db, gen = db_session(client)
    try:
        user_id = db.query(UserRow).first().id
        _seed_workout(db, user_id, "w1")
        _seed_garmin_day(db, user_id)  # activity only on DATE
    finally:
        db.close()
        close_db(gen)

    unknown_workout = client.post(LINKS_PATH, json=_link_body("missing", ACTIVITY_ID), headers=auth)
    assert unknown_workout.status_code == 404

    unknown_activity = client.post(LINKS_PATH, json=_link_body("w1", "999"), headers=auth)
    assert unknown_activity.status_code == 404

    # The activity must be in the workout's local_date payload, not just any day.
    db, gen = db_session(client)
    try:
        _seed_garmin_day(db, user_id, date_key="2026-11-09", activity_ids=(OTHER_ACTIVITY_ID,))
    finally:
        db.close()
        close_db(gen)
    other_day = client.post(LINKS_PATH, json=_link_body("w1", OTHER_ACTIVITY_ID), headers=auth)
    assert other_day.status_code == 404


def test_delete_link_404_for_unknown_workout(client: TestClient) -> None:
    auth = _auth_headers(client)
    response = client.request("DELETE", LINKS_PATH, json=_link_body("missing", ACTIVITY_ID), headers=auth)
    assert response.status_code == 404


def test_link_endpoints_require_external_api_key(client: TestClient) -> None:
    body = _link_body("w1", ACTIVITY_ID)
    assert client.post(LINKS_PATH, json=body).status_code == 401
    assert client.request("DELETE", LINKS_PATH, json=body).status_code == 401


# --- bulk load endpoints ------------------------------------------------------------


class FakeHevyClient:
    """HevyClient stand-in with canned pages/workouts (no network)."""

    def __init__(
        self,
        *,
        template_pages: list[dict] | None = None,
        workout_pages: list[dict] | None = None,
        event_pages: list[dict] | None = None,
        workouts_by_id: dict[str, dict] | None = None,
    ) -> None:
        self.template_pages = template_pages or []
        self.workout_pages = workout_pages or []
        self.event_pages = event_pages or []
        self.workouts_by_id = workouts_by_id or {}
        self.calls: list[str] = []

    def get_exercise_templates(self, page: int = 1, page_size: int = 10) -> dict:
        self.calls.append(f"get_exercise_templates:{page}")
        return self._page(self.template_pages, page, "exercise_templates")

    def get_workouts(self, page: int = 1, page_size: int = 10) -> dict:
        self.calls.append(f"get_workouts:{page}")
        return self._page(self.workout_pages, page, "workouts")

    def get_workout_events(self, page: int = 1, page_size: int = 10) -> dict:
        self.calls.append(f"get_workout_events:{page}")
        return self._page(self.event_pages, page, "workout_events")

    def get_workout(self, workout_id: str) -> dict | None:
        self.calls.append(f"get_workout:{workout_id}")
        return self.workouts_by_id.get(workout_id)

    @staticmethod
    def _page(pages: list[dict], page: int, key: str) -> dict:
        if 1 <= page <= len(pages):
            return pages[page - 1]
        return {key: [], "page": page, "page_count": len(pages)}


def _raw_template(template_id: str, title: str) -> dict:
    return {
        "id": template_id,
        "title": title,
        "type": "weight & rep",
        "primary_muscle_group": "lats",
        "secondary_muscle_groups": ["biceps"],
        "equipment": "barbell",
        "is_custom": False,
        "thumbnail_url": None,
    }


def _raw_workout(workout_id: str) -> dict:
    return {
        "id": workout_id,
        "title": "Push Day",
        "routine_id": None,
        "description": "",
        "start_time": "2026-11-10T14:22:00+00:00",
        "end_time": "2026-11-10T15:10:00+00:00",
        "updated_at": "2026-11-10T15:11:00.000Z",
        "exercises": [
            {
                "index": 0,
                "title": "Bent Over Row (Barbell)",
                "exercise_template_id": "55E6546F",
                "superset_id": None,
                "rest_seconds": None,
                "notes": None,
                "sets": [{"index": 0, "type": "normal", "weight_kg": 40, "reps": 10}],
            }
        ],
    }


@pytest.fixture()
def fake_hevy(client: TestClient) -> FakeHevyClient:
    fake = FakeHevyClient()
    client.app.dependency_overrides[external_routes.require_hevy_configured] = lambda: fake
    return fake


def test_load_templates_returns_real_count_and_stamps_sync_state(
    client: TestClient, fake_hevy: FakeHevyClient
) -> None:
    fake_hevy.template_pages = [
        {"exercise_templates": [_raw_template("55E6546F", "Bent Over Row (Barbell)")], "page": 1, "page_count": 2},
        {"exercise_templates": [_raw_template("ABCD1234", "Bench Press"), _raw_template("TEST0002", "Air Bike")], "page": 2, "page_count": 2},
    ]
    auth = _auth_headers(client)

    response = client.post(LOAD_PATHS["templates"], headers=auth)

    assert response.status_code == 200, response.text
    assert response.json() == {"count": 3}
    assert fake_hevy.calls == ["get_exercise_templates:1", "get_exercise_templates:2"]

    db, gen = db_session(client)
    try:
        state = db.query(HevySyncStateRow).one()
        assert state.templates_synced_at is not None
    finally:
        db.close()
        close_db(gen)


def test_load_workouts_backfills_and_returns_count(client: TestClient, fake_hevy: FakeHevyClient) -> None:
    fake_hevy.workout_pages = [
        {"workouts": [_raw_workout("w1"), _raw_workout("w2")], "page": 1, "page_count": 1}
    ]
    auth = _auth_headers(client)

    response = client.post(LOAD_PATHS["workouts"], headers=auth)

    assert response.status_code == 200, response.text
    assert response.json() == {"count": 2}

    # Idempotent re-run: same count, no duplicates.
    again = client.post(LOAD_PATHS["workouts"], headers=auth)
    assert again.json() == {"count": 2}

    db, gen = db_session(client)
    try:
        assert db.query(HevyWorkoutRow).count() == 2
    finally:
        db.close()
        close_db(gen)


def test_load_events_applies_events_since_last_run(client: TestClient, fake_hevy: FakeHevyClient) -> None:
    fake_hevy.event_pages = [
        {
            "workout_events": [
                {
                    "id": "event-1",
                    "type": "update",
                    "workout_id": "w1",
                    "updated_at": "2026-11-10T15:11:00.000Z",
                }
            ],
            "page": 1,
            "page_count": 1,
        }
    ]
    fake_hevy.workouts_by_id = {"w1": _raw_workout("w1")}
    auth = _auth_headers(client)

    first = client.post(LOAD_PATHS["events"], headers=auth)
    assert first.status_code == 200, first.text
    assert first.json() == {"count": 1}

    second = client.post(LOAD_PATHS["events"], headers=auth)
    assert second.json() == {"count": 0}  # the event is at/before the stored cursor

    db, gen = db_session(client)
    try:
        state = db.query(HevySyncStateRow).one()
        assert state.last_event_processed_at is not None
    finally:
        db.close()
        close_db(gen)


@pytest.mark.parametrize("path", list(LOAD_PATHS.values()))
def test_load_endpoints_return_503_without_hevy_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, path: str
) -> None:
    monkeypatch.setattr(external_routes, "get_settings", lambda: Settings(hevy_api_key=""))
    auth = _auth_headers(client)

    response = client.post(path, headers=auth)

    assert response.status_code == 503
    assert response.json() == {"detail": "Hevy not configured"}


@pytest.mark.parametrize("path", list(LOAD_PATHS.values()))
def test_load_endpoints_require_external_api_key(client: TestClient, fake_hevy: FakeHevyClient, path: str) -> None:
    assert client.post(path).status_code == 401
