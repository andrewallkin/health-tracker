"""Tests for the Hevy webhook receiver and catch-up scheduler (Task 8).

The webhook's background sync is injectable: tests monkeypatch it (or the
spawner) so no network and no real database is touched. The catch-up cycle
is tested with a sqlite sessionmaker injected the same way.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.api import hevy_webhook, snapshot_scheduler
from backend.config import Settings
from backend.database import Base
from backend.db_models import HevySyncStateRow, HevyWorkoutRow, UserRow

WEBHOOK_PATH = "/api/hevy/webhook"
TOKEN = "webhook-secret"


# --- fakes and fixtures ----------------------------------------------------------


class RecordingClient:
    """HevyClient stand-in that records calls and returns nothing (no network)."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    def get_workout(self, workout_id: str) -> dict | None:
        self.calls.append(f"get_workout:{workout_id}")
        return None


class FakeHevyClient:
    """HevyClient stand-in with canned event pages and workouts (no network)."""

    def __init__(self, *, event_pages: list[dict] | None = None, workouts_by_id: dict[str, dict] | None = None):
        self.event_pages = event_pages or []
        self.workouts_by_id = workouts_by_id or {}
        self.calls: list[str] = []

    def get_workout(self, workout_id: str) -> dict | None:
        self.calls.append(f"get_workout:{workout_id}")
        return self.workouts_by_id.get(workout_id)

    def get_workout_events(self, page: int = 1, page_size: int = 10) -> dict:
        self.calls.append(f"get_workout_events:{page}")
        if 1 <= page <= len(self.event_pages):
            return self.event_pages[page - 1]
        return {"workout_events": [], "page": page, "page_count": len(self.event_pages)}


def _make_engine() -> Engine:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_connection, _connection_record):  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


@pytest.fixture()
def sqlite_db():
    engine = _make_engine()
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    yield TestingSessionLocal


@pytest.fixture()
def token_settings(monkeypatch: pytest.MonkeyPatch):
    settings = Settings(hevy_webhook_token=TOKEN)
    monkeypatch.setattr(hevy_webhook, "get_settings", lambda: settings)
    return settings


def _create_user(db) -> UserRow:
    user = UserRow(
        id=str(uuid.uuid4()),
        email=f"{uuid.uuid4()}@example.com",
        hashed_password="hash",
    )
    db.add(user)
    db.commit()
    return user


def _raw_workout(workout_id: str) -> dict:
    return {
        "id": workout_id,
        "title": "Push Day",
        "routine_id": None,
        "description": "",
        "start_time": "2026-11-09T16:22:00+00:00",
        "end_time": "2026-11-09T17:10:00+00:00",
        "updated_at": "2026-11-09T17:11:00.000Z",
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


# --- webhook auth ----------------------------------------------------------------


def test_webhook_returns_503_when_token_unset(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    fake = RecordingClient()
    monkeypatch.setattr(hevy_webhook, "get_settings", lambda: Settings(hevy_webhook_token=""))
    monkeypatch.setattr(hevy_webhook, "hevy_client_from_settings", lambda settings: fake)

    response = client.post(
        WEBHOOK_PATH,
        json={"workoutId": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {TOKEN}"},
    )

    assert response.status_code == 503
    assert fake.calls == []


def test_webhook_rejects_missing_or_wrong_token(
    client: TestClient, token_settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = RecordingClient()
    monkeypatch.setattr(hevy_webhook, "hevy_client_from_settings", lambda settings: fake)
    spawned: list[str] = []
    monkeypatch.setattr(hevy_webhook, "_spawn_sync", lambda workout_id: spawned.append(workout_id))

    missing = client.post(WEBHOOK_PATH, json={"workoutId": str(uuid.uuid4())})
    wrong = client.post(
        WEBHOOK_PATH,
        json={"workoutId": str(uuid.uuid4())},
        headers={"Authorization": "Bearer nope"},
    )
    wrong_raw = client.post(
        WEBHOOK_PATH,
        json={"workoutId": str(uuid.uuid4())},
        headers={"Authorization": TOKEN + "x"},
    )

    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert wrong_raw.status_code == 401
    assert spawned == []
    assert fake.calls == []


# --- webhook body validation ------------------------------------------------------


@pytest.mark.parametrize(
    "body",
    [
        '{"workoutId": "x"',  # invalid JSON
        '{"notWorkoutId": "x"}',  # missing workoutId
        '{"workoutId": 123}',  # wrong type
        '{"workoutId": ""}',  # blank
        "[]",  # not an object
    ],
)
def test_webhook_rejects_malformed_body(
    client: TestClient, token_settings, monkeypatch: pytest.MonkeyPatch, body: str
) -> None:
    fake = RecordingClient()
    monkeypatch.setattr(hevy_webhook, "hevy_client_from_settings", lambda settings: fake)
    spawned: list[str] = []
    monkeypatch.setattr(hevy_webhook, "_spawn_sync", lambda workout_id: spawned.append(workout_id))

    response = client.post(
        WEBHOOK_PATH,
        content=body,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert spawned == []
    assert fake.calls == []


# --- webhook acceptance: spawn, zero Hevy calls on the request path ---------------


def test_webhook_accepts_and_spawns_background_sync_without_hevy_calls(
    client: TestClient, token_settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = RecordingClient()
    monkeypatch.setattr(hevy_webhook, "hevy_client_from_settings", lambda settings: fake)
    spawned: list[str] = []
    monkeypatch.setattr(hevy_webhook, "_spawn_sync", lambda workout_id: spawned.append(workout_id))

    first = str(uuid.uuid4())
    second = str(uuid.uuid4())
    bearer = client.post(WEBHOOK_PATH, json={"workoutId": first}, headers={"Authorization": f"Bearer {TOKEN}"})
    raw = client.post(WEBHOOK_PATH, json={"workoutId": second}, headers={"Authorization": TOKEN})

    assert bearer.status_code == 200
    assert bearer.json() == {"status": "accepted"}
    assert raw.status_code == 200  # Hevy may send the token without the Bearer prefix
    assert spawned == [first, second]
    assert fake.calls == []  # zero Hevy calls on the request path


def test_spawn_sync_runs_background_function_on_thread(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[str] = []
    monkeypatch.setattr(hevy_webhook, "run_webhook_sync", lambda workout_id: seen.append(workout_id))

    thread = hevy_webhook._spawn_sync("w1")
    thread.join(timeout=5)

    assert seen == ["w1"]
    assert not thread.is_alive()


# --- background worker (called inline via the injectable function) ----------------


def test_webhook_background_sync_fetches_and_upserts_workout(sqlite_db, monkeypatch: pytest.MonkeyPatch) -> None:
    db = sqlite_db()
    user = _create_user(db)
    user_id = user.id
    db.close()

    workout_id = str(uuid.uuid4())
    fake = FakeHevyClient(workouts_by_id={workout_id: _raw_workout(workout_id)})
    monkeypatch.setattr(hevy_webhook, "hevy_client_from_settings", lambda settings: fake)
    monkeypatch.setattr(hevy_webhook, "SessionLocal", sqlite_db)

    hevy_webhook.run_webhook_sync(workout_id)

    assert fake.calls == [f"get_workout:{workout_id}"]
    check = sqlite_db()
    try:
        row = check.get(HevyWorkoutRow, workout_id)
        assert row is not None
        assert row.user_id == user_id
        assert row.title == "Push Day"
        assert row.local_date == "2026-11-09"  # 16:22 UTC == 18:22 SAST, same day
        assert row.garmin_activity_ids == []
    finally:
        check.close()


def test_webhook_background_sync_skips_when_hevy_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(hevy_webhook, "hevy_client_from_settings", lambda settings: None)

    def _boom() -> None:
        raise AssertionError("SessionLocal must not be used when Hevy is unconfigured")

    monkeypatch.setattr(hevy_webhook, "SessionLocal", _boom)

    hevy_webhook.run_webhook_sync(str(uuid.uuid4()))  # returns silently


# --- catch-up scheduler cycle ------------------------------------------------------


def test_hevy_catchup_cycle_applies_new_events_once(sqlite_db, monkeypatch: pytest.MonkeyPatch) -> None:
    db = sqlite_db()
    _create_user(db)
    db.close()

    workout_id = str(uuid.uuid4())
    fake = FakeHevyClient(
        event_pages=[
            {
                "workout_events": [
                    {
                        "id": "event-1",
                        "type": "update",
                        "workout_id": workout_id,
                        "updated_at": "2026-11-09T17:11:00.000Z",
                    }
                ],
                "page": 1,
                "page_count": 1,
            }
        ],
        workouts_by_id={workout_id: _raw_workout(workout_id)},
    )
    monkeypatch.setattr(snapshot_scheduler, "hevy_client_from_settings", lambda settings: fake)
    monkeypatch.setattr(snapshot_scheduler, "SessionLocal", sqlite_db)

    assert snapshot_scheduler.hevy_catchup_cycle() == 1

    check = sqlite_db()
    try:
        assert check.get(HevyWorkoutRow, workout_id) is not None
        state = check.query(HevySyncStateRow).one()
        assert state.last_event_processed_at is not None
    finally:
        check.close()

    # Second cycle: the event is at/before `since` -> nothing applied again.
    assert snapshot_scheduler.hevy_catchup_cycle() == 0
    assert fake.calls.count(f"get_workout:{workout_id}") == 1


def test_hevy_catchup_cycle_skips_when_hevy_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(snapshot_scheduler, "hevy_client_from_settings", lambda settings: None)

    def _boom() -> None:
        raise AssertionError("SessionLocal must not be used when Hevy is unconfigured")

    monkeypatch.setattr(snapshot_scheduler, "SessionLocal", _boom)

    assert snapshot_scheduler.hevy_catchup_cycle() == 0


def test_hevy_catchup_cycle_skips_when_no_user_is_configured(sqlite_db, monkeypatch: pytest.MonkeyPatch) -> None:
    fake = FakeHevyClient()
    monkeypatch.setattr(snapshot_scheduler, "hevy_client_from_settings", lambda settings: fake)
    monkeypatch.setattr(snapshot_scheduler, "SessionLocal", sqlite_db)

    assert snapshot_scheduler.hevy_catchup_cycle() == 0
    assert fake.calls == []  # no event fetch without a configured user
