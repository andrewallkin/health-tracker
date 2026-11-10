from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.db_models import (
    GarminDailyHealthRow,
    HevyExerciseTemplateRow,
    HevySyncStateRow,
    HevyWorkoutRow,
    UserRow,
)
from backend.hevy_sync import (
    backfill_workouts,
    reconcile_links,
    sync_exercise_templates,
    sync_workout,
    sync_workout_events,
)

UTC = timezone.utc
TZ_NAME = "Africa/Johannesburg"  # SAST = UTC+02:00, no DST


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
def db_session():
    engine = _make_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _create_user(db) -> UserRow:
    user = UserRow(
        id=str(uuid.uuid4()),
        email=f"{uuid.uuid4()}@example.com",
        hashed_password="hash",
    )
    db.add(user)
    db.commit()
    return user


def _raw_template(template_id: str, title: str, **overrides) -> dict:
    raw = {
        "id": template_id,
        "title": title,
        "type": "weight & rep",
        "primary_muscle_group": "lats",
        "secondary_muscle_groups": ["biceps"],
        "equipment": "barbell",
        "is_custom": False,
        "thumbnail_url": None,
        "future_template_field": "ignored",
    }
    raw.update(overrides)
    return raw


def _raw_workout(workout_id: str, *, start: str, end: str, title: str = "Push Day") -> dict:
    return {
        "id": workout_id,
        "title": title,
        "routine_id": None,
        "description": "",
        "start_time": start,
        "end_time": end,
        "updated_at": "2026-10-24T15:11:00.500Z",
        "exercises": [
            {
                "index": 0,
                "title": "Bent Over Row (Barbell)",
                "exercise_template_id": "55E6546F",
                "superset_id": None,
                "rest_seconds": None,
                "notes": None,
                "sets": [
                    {
                        "index": 0,
                        "type": "normal",
                        "weight_kg": 40,
                        "reps": 10,
                    }
                ],
                "future_exercise_field": "ignored",
            }
        ],
        "future_workout_field": "ignored",
    }


class FakeHevyClient:
    """In-memory stand-in for HevyClient: canned pages, zero network."""

    def __init__(
        self,
        *,
        workout_pages: list[dict] | None = None,
        event_pages: list[dict] | None = None,
        template_pages: list[dict] | None = None,
        workouts_by_id: dict[str, dict] | None = None,
    ) -> None:
        self.workout_pages = workout_pages or []
        self.event_pages = event_pages or []
        self.template_pages = template_pages or []
        self.workouts_by_id = workouts_by_id or {}
        self.calls: list[str] = []

    def get_workouts(self, page: int = 1, page_size: int = 10) -> dict:
        self.calls.append(f"get_workouts:{page}")
        return self._page(self.workout_pages, page, "workouts")

    def get_workout(self, workout_id: str) -> dict | None:
        self.calls.append(f"get_workout:{workout_id}")
        return self.workouts_by_id.get(workout_id)

    def get_workout_events(self, page: int = 1, page_size: int = 10) -> dict:
        self.calls.append(f"get_workout_events:{page}")
        return self._page(self.event_pages, page, "workout_events")

    def get_exercise_templates(self, page: int = 1, page_size: int = 10) -> dict:
        self.calls.append(f"get_exercise_templates:{page}")
        return self._page(self.template_pages, page, "exercise_templates")

    @staticmethod
    def _page(pages: list[dict], page: int, key: str) -> dict:
        if 1 <= page <= len(pages):
            return pages[page - 1]
        return {key: [], "page": page, "page_count": len(pages)}


def _seed_garmin_day(db, user_id: str, date_str: str, activities: list[dict]) -> GarminDailyHealthRow:
    row = GarminDailyHealthRow(
        user_id=user_id,
        date=date_str,
        payload={"date": date_str, "activities": activities},
        is_complete=True,
    )
    db.add(row)
    db.commit()
    return row


def _seed_workout(
    db,
    user_id: str,
    workout_id: str,
    *,
    start_utc: datetime,
    local_date: str,
    garmin_activity_ids: list[str] | None = None,
) -> HevyWorkoutRow:
    row = HevyWorkoutRow(
        id=workout_id,
        user_id=user_id,
        title="Push Day",
        start_time=start_utc,
        end_time=start_utc + timedelta(minutes=48),
        local_date=local_date,
        garmin_activity_ids=garmin_activity_ids if garmin_activity_ids is not None else [],
        payload={"exercises": []},
    )
    db.add(row)
    db.commit()
    return db.get(HevyWorkoutRow, workout_id)


# --- sync_exercise_templates -------------------------------------------------


def test_sync_exercise_templates_upserts_pages_and_is_idempotent(db_session) -> None:
    client = FakeHevyClient(
        template_pages=[
            {
                "exercise_templates": [
                    _raw_template("55E6546F", "Bent Over Row (Barbell)"),
                    _raw_template("TEST0001", "Air Bike", type="duration", equipment="none"),
                ],
                "page": 1,
                "page_count": 2,
            },
            {
                "exercise_templates": [
                    _raw_template("ABCD1234", "Barbell Bench Press", primary_muscle_group="chest")
                ],
                "page": 2,
                "page_count": 2,
            },
        ]
    )

    first = sync_exercise_templates(db_session, client)

    assert first == 3
    assert client.calls == ["get_exercise_templates:1", "get_exercise_templates:2"]
    rows = {row.id: row for row in db_session.query(HevyExerciseTemplateRow).all()}
    assert set(rows) == {"55E6546F", "TEST0001", "ABCD1234"}
    assert rows["55E6546F"].title == "Bent Over Row (Barbell)"
    assert rows["55E6546F"].secondary_muscle_groups == ["biceps"]
    assert rows["TEST0001"].type == "duration"
    assert rows["ABCD1234"].primary_muscle_group == "chest"

    # Idempotent re-run: same count, no duplicates, and updated fields upsert.
    client.template_pages[0]["exercise_templates"][0]["title"] = "Bent Over Row"
    second = sync_exercise_templates(db_session, client)

    assert second == 3
    assert db_session.query(HevyExerciseTemplateRow).count() == 3
    assert db_session.get(HevyExerciseTemplateRow, "55E6546F").title == "Bent Over Row"


# --- sync_workout ------------------------------------------------------------


def test_sync_workout_stores_row_with_sast_local_date(db_session) -> None:
    user = _create_user(db_session)
    workout_id = "05fcaa01-d0ec-4206-bd4e-a47585915642"
    # 16:22 UTC → 18:22 SAST, same calendar day (before 22:00 UTC cutoff).
    client = FakeHevyClient(
        workouts_by_id={
            workout_id: _raw_workout(
                workout_id,
                start="2026-10-24T16:22:00+00:00",
                end="2026-10-24T17:10:00+00:00",
            )
        }
    )

    row = sync_workout(db_session, user.id, client, workout_id)

    assert row is not None
    assert row.user_id == user.id
    assert row.title == "Push Day"
    assert row.local_date == "2026-10-24"
    assert row.payload["exercises"][0]["exercise_template_id"] == "55E6546F"
    assert row.garmin_activity_ids == []

    # Idempotent re-run: still exactly one row.
    again = sync_workout(db_session, user.id, client, workout_id)
    assert again is not None
    assert again.id == row.id
    assert db_session.query(HevyWorkoutRow).count() == 1


def test_sync_workout_returns_none_when_not_found(db_session) -> None:
    user = _create_user(db_session)
    client = FakeHevyClient()

    assert sync_workout(db_session, user.id, client, "missing-workout") is None
    assert db_session.query(HevyWorkoutRow).count() == 0


def test_sync_workout_local_date_rolls_over_at_sast_midnight(db_session) -> None:
    user = _create_user(db_session)
    # 22:30 UTC = 00:30 SAST on 2026-10-25: local_date must roll to the next day.
    client = FakeHevyClient(
        workouts_by_id={
            "workout-late": _raw_workout(
                "workout-late",
                start="2026-10-24T22:30:00+00:00",
                end="2026-10-24T23:15:00+00:00",
                title="Late-night session",
            )
        }
    )

    row = sync_workout(db_session, user.id, client, "workout-late")

    assert row is not None
    assert row.local_date == "2026-10-25"


# --- reconcile_links ----------------------------------------------------------


def test_reconcile_links_matches_overlapping_garmin_activity(db_session) -> None:
    user = _create_user(db_session)
    # Workout starts 14:22 UTC = 16:22 SAST; Garmin activity starts 16:22 local.
    _seed_garmin_day(
        db_session,
        user.id,
        "2026-10-24",
        [
            {
                "id": "24833957297",
                "name": "Cardio",
                "type": "cardio",
                "startTime": "16:22",
                "durationMin": 62,
            }
        ],
    )
    row = _seed_workout(
        db_session,
        user.id,
        "workout-1",
        start_utc=datetime(2026, 10, 24, 14, 22, tzinfo=UTC),
        local_date="2026-10-24",
    )

    links = reconcile_links(db_session, row)

    assert links == ["24833957297"]
    assert db_session.get(HevyWorkoutRow, "workout-1").garmin_activity_ids == ["24833957297"]


def test_reconcile_links_ignores_activity_outside_window(db_session) -> None:
    user = _create_user(db_session)
    # 21:00 SAST vs 16:22 SAST workout start: way beyond 20 minutes.
    _seed_garmin_day(
        db_session,
        user.id,
        "2026-10-24",
        [
            {
                "id": "night-activity",
                "name": "Evening walk",
                "type": "walking",
                "startTime": "21:00",
                "durationMin": 30,
            }
        ],
    )
    row = _seed_workout(
        db_session,
        user.id,
        "workout-1",
        start_utc=datetime(2026, 10, 24, 14, 22, tzinfo=UTC),
        local_date="2026-10-24",
    )

    links = reconcile_links(db_session, row)

    assert links == []
    assert db_session.get(HevyWorkoutRow, "workout-1").garmin_activity_ids == []


def test_reconcile_links_keeps_closest_candidate_one_to_one(db_session) -> None:
    user = _create_user(db_session)
    # Both candidates fall inside the 20-minute window; the 16:22 one is closer.
    _seed_garmin_day(
        db_session,
        user.id,
        "2026-10-24",
        [
            {
                "id": "near-activity",
                "name": "Cardio",
                "type": "cardio",
                "startTime": "16:22",
                "durationMin": 62,
            },
            {
                "id": "farther-activity",
                "name": "Walk",
                "type": "walking",
                "startTime": "16:35",
                "durationMin": 20,
            },
        ],
    )
    row = _seed_workout(
        db_session,
        user.id,
        "workout-1",
        start_utc=datetime(2026, 10, 24, 14, 22, tzinfo=UTC),
        local_date="2026-10-24",
    )

    links = reconcile_links(db_session, row)

    assert links == ["near-activity"]
    assert len(links) == 1


def test_reconcile_links_never_overwrites_existing_links(db_session) -> None:
    user = _create_user(db_session)
    _seed_garmin_day(
        db_session,
        user.id,
        "2026-10-24",
        [
            {
                "id": "candidate-activity",
                "name": "Cardio",
                "type": "cardio",
                "startTime": "16:22",
                "durationMin": 62,
            }
        ],
    )
    row = _seed_workout(
        db_session,
        user.id,
        "workout-1",
        start_utc=datetime(2026, 10, 24, 14, 22, tzinfo=UTC),
        local_date="2026-10-24",
        garmin_activity_ids=["already-linked"],
    )

    links = reconcile_links(db_session, row)

    assert links == ["already-linked"]
    assert db_session.get(HevyWorkoutRow, "workout-1").garmin_activity_ids == ["already-linked"]


def test_sync_workout_links_activity_just_after_sast_midnight(db_session) -> None:
    user = _create_user(db_session)
    # Workout 22:10 UTC = 00:10 SAST on 2026-10-25, so local_date rolls over.
    # The previous day's row holds a within-window activity (23:55 is 15 minutes
    # before 00:10), but linking is scoped to the workout's local_date only.
    _seed_garmin_day(
        db_session,
        user.id,
        "2026-10-24",
        [
            {
                "id": "previous-day-activity",
                "name": "Evening run",
                "type": "running",
                "startTime": "23:55",
                "durationMin": 30,
            }
        ],
    )
    _seed_garmin_day(
        db_session,
        user.id,
        "2026-10-25",
        [
            {
                "id": "midnight-activity",
                "name": "Cardio",
                "type": "cardio",
                "startTime": "00:05",
                "durationMin": 62,
            }
        ],
    )
    client = FakeHevyClient(
        workouts_by_id={
            "workout-midnight": _raw_workout(
                "workout-midnight",
                start="2026-10-24T22:10:00+00:00",
                end="2026-10-24T23:00:00+00:00",
            )
        }
    )

    row = sync_workout(db_session, user.id, client, "workout-midnight")

    assert row is not None
    assert row.local_date == "2026-10-25"
    assert row.garmin_activity_ids == ["midnight-activity"]


# --- sync_workout_events ------------------------------------------------------


def test_sync_workout_events_delete_event_removes_row(db_session) -> None:
    user = _create_user(db_session)
    _seed_workout(
        db_session,
        user.id,
        "workout-1",
        start_utc=datetime(2026, 10, 24, 14, 22, tzinfo=UTC),
        local_date="2026-10-24",
    )
    client = FakeHevyClient(
        event_pages=[
            {
                "workout_events": [
                    {
                        "id": "event-1",
                        "type": "delete",
                        "workout_id": "workout-1",
                        "deleted_at": "2026-10-25T08:00:00Z",
                    }
                ],
                "page": 1,
                "page_count": 1,
            }
        ]
    )

    applied = sync_workout_events(db_session, user.id, client, since=None)

    assert applied == 1
    assert db_session.query(HevyWorkoutRow).count() == 0
    state = db_session.query(HevySyncStateRow).filter_by(user_id=user.id).one()
    assert state.last_event_processed_at == datetime(2026, 10, 25, 8, 0)


def test_sync_workout_events_update_event_upserts_workout(db_session) -> None:
    user = _create_user(db_session)
    client = FakeHevyClient(
        event_pages=[
            {
                "workout_events": [
                    {
                        "id": "event-1",
                        "type": "update",
                        "workout_id": "workout-1",
                        "updated_at": "2026-10-25T09:00:00Z",
                    }
                ],
                "page": 1,
                "page_count": 1,
            }
        ],
        workouts_by_id={
            "workout-1": _raw_workout(
                "workout-1",
                start="2026-10-24T16:22:00+00:00",
                end="2026-10-24T17:10:00+00:00",
                title="Renamed session",
            )
        },
    )

    applied = sync_workout_events(db_session, user.id, client, since=None)

    assert applied == 1
    row = db_session.get(HevyWorkoutRow, "workout-1")
    assert row is not None
    assert row.user_id == user.id
    assert row.title == "Renamed session"
    assert row.local_date == "2026-10-24"
    state = db_session.query(HevySyncStateRow).filter_by(user_id=user.id).one()
    assert state.last_event_processed_at == datetime(2026, 10, 25, 9, 0)


def test_sync_workout_events_skips_events_at_or_before_since(db_session) -> None:
    user = _create_user(db_session)
    _seed_workout(
        db_session,
        user.id,
        "workout-1",
        start_utc=datetime(2026, 10, 24, 14, 22, tzinfo=UTC),
        local_date="2026-10-24",
    )
    client = FakeHevyClient(
        event_pages=[
            {
                "workout_events": [
                    {
                        "id": "event-1",
                        "type": "delete",
                        "workout_id": "workout-1",
                        "deleted_at": "2026-10-24T10:00:00Z",
                    }
                ],
                "page": 1,
                "page_count": 1,
            }
        ]
    )
    since = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)

    applied = sync_workout_events(db_session, user.id, client, since=since)

    assert applied == 0
    assert db_session.query(HevyWorkoutRow).count() == 1  # delete was skipped
    state = db_session.query(HevySyncStateRow).filter_by(user_id=user.id).one()
    assert state.last_event_processed_at == datetime(2026, 10, 24, 12, 0)


def test_sync_workout_events_handles_event_without_timestamp(db_session) -> None:
    """A ts-less event must not crash the chronological sort; it applies last."""
    user = _create_user(db_session)
    _seed_workout(
        db_session,
        user.id,
        "workout-1",
        start_utc=datetime(2026, 10, 24, 14, 22, tzinfo=UTC),
        local_date="2026-10-24",
    )
    client = FakeHevyClient(
        event_pages=[
            {
                "workout_events": [
                    {
                        "id": "event-ts",
                        "type": "update",
                        "workout_id": "workout-1",
                        "updated_at": "2026-10-25T09:00:00Z",
                    },
                    {
                        "id": "event-no-ts",
                        "type": "delete",
                        "workout_id": "workout-1",
                    },
                ],
                "page": 1,
                "page_count": 1,
            }
        ],
        workouts_by_id={
            "workout-1": _raw_workout(
                "workout-1",
                start="2026-10-24T16:22:00+00:00",
                end="2026-10-24T17:10:00+00:00",
            )
        },
    )

    applied = sync_workout_events(db_session, user.id, client, since=None)

    assert applied == 2
    # The ts-less delete sorts after the timestamped update, so it wins.
    assert db_session.query(HevyWorkoutRow).count() == 0
    state = db_session.query(HevySyncStateRow).filter_by(user_id=user.id).one()
    assert state.last_event_processed_at == datetime(2026, 10, 25, 9, 0)


@pytest.mark.parametrize(
    "delete_first_page", [False, True], ids=["update-on-page1", "delete-on-page1"]
)
def test_sync_workout_events_newer_update_survives_older_delete(
    db_session, delete_first_page
) -> None:
    """Events replay chronologically regardless of page order: newest wins."""
    user = _create_user(db_session)
    _seed_workout(
        db_session,
        user.id,
        "workout-1",
        start_utc=datetime(2026, 10, 24, 14, 22, tzinfo=UTC),
        local_date="2026-10-24",
    )
    update_event = {
        "id": "event-update",
        "type": "update",
        "workout_id": "workout-1",
        "updated_at": "2026-10-25T12:00:00Z",  # NEWER event
    }
    delete_event = {
        "id": "event-delete",
        "type": "delete",
        "workout_id": "workout-1",
        "deleted_at": "2026-10-25T10:00:00Z",  # OLDER event
    }
    update_page = {"workout_events": [update_event], "page": 1, "page_count": 2}
    delete_page = {"workout_events": [delete_event], "page": 2, "page_count": 2}
    client = FakeHevyClient(
        event_pages=(
            [delete_page, update_page] if delete_first_page else [update_page, delete_page]
        ),
        workouts_by_id={
            "workout-1": _raw_workout(
                "workout-1",
                start="2026-10-24T16:22:00+00:00",
                end="2026-10-24T17:10:00+00:00",
                title="Renamed session",
            )
        },
    )

    applied = sync_workout_events(db_session, user.id, client, since=None)

    assert applied == 2
    row = db_session.get(HevyWorkoutRow, "workout-1")
    assert row is not None  # the newer update outranks the older delete
    assert row.title == "Renamed session"
    state = db_session.query(HevySyncStateRow).filter_by(user_id=user.id).one()
    assert state.last_event_processed_at == datetime(2026, 10, 25, 12, 0)


@pytest.mark.parametrize(
    "update_first_page", [False, True], ids=["delete-on-page1", "update-on-page1"]
)
def test_sync_workout_events_older_update_never_clobbers_newer_delete(
    db_session, update_first_page
) -> None:
    """A newer delete must stand even when an older update arrives on a later page."""
    user = _create_user(db_session)
    _seed_workout(
        db_session,
        user.id,
        "workout-1",
        start_utc=datetime(2026, 10, 24, 14, 22, tzinfo=UTC),
        local_date="2026-10-24",
    )
    update_event = {
        "id": "event-update",
        "type": "update",
        "workout_id": "workout-1",
        "updated_at": "2026-10-25T10:00:00Z",  # OLDER event, arrives later
    }
    delete_event = {
        "id": "event-delete",
        "type": "delete",
        "workout_id": "workout-1",
        "deleted_at": "2026-10-25T12:00:00Z",  # NEWER event
    }
    update_page = {"workout_events": [update_event], "page": 1, "page_count": 2}
    delete_page = {"workout_events": [delete_event], "page": 2, "page_count": 2}
    client = FakeHevyClient(
        event_pages=(
            [update_page, delete_page] if update_first_page else [delete_page, update_page]
        ),
        workouts_by_id={
            "workout-1": _raw_workout(
                "workout-1",
                start="2026-10-24T16:22:00+00:00",
                end="2026-10-24T17:10:00+00:00",
            )
        },
    )

    applied = sync_workout_events(db_session, user.id, client, since=None)

    assert applied == 2
    assert db_session.query(HevyWorkoutRow).count() == 0  # the delete stands
    state = db_session.query(HevySyncStateRow).filter_by(user_id=user.id).one()
    assert state.last_event_processed_at == datetime(2026, 10, 25, 12, 0)


def test_sync_workout_events_update_links_garmin_activity(db_session) -> None:
    """Workouts first discovered via the events feed get Garmin links too."""
    user = _create_user(db_session)
    # Workout 14:22 UTC = 16:22 SAST on 2026-10-24; activity starts 16:22 local.
    _seed_garmin_day(
        db_session,
        user.id,
        "2026-10-24",
        [
            {
                "id": "24833957297",
                "name": "Cardio",
                "type": "cardio",
                "startTime": "16:22",
                "durationMin": 62,
            }
        ],
    )
    client = FakeHevyClient(
        event_pages=[
            {
                "workout_events": [
                    {
                        "id": "event-1",
                        "type": "update",
                        "workout_id": "workout-1",
                        "updated_at": "2026-10-25T09:00:00Z",
                    }
                ],
                "page": 1,
                "page_count": 1,
            }
        ],
        workouts_by_id={
            "workout-1": _raw_workout(
                "workout-1",
                start="2026-10-24T14:22:00+00:00",
                end="2026-10-24T15:10:00+00:00",
            )
        },
    )

    applied = sync_workout_events(db_session, user.id, client, since=None)

    assert applied == 1
    row = db_session.get(HevyWorkoutRow, "workout-1")
    assert row is not None
    assert row.garmin_activity_ids == ["24833957297"]

    # Re-applying the same event must never duplicate or overwrite the link.
    applied_again = sync_workout_events(db_session, user.id, client, since=None)

    assert applied_again == 1
    assert db_session.query(HevyWorkoutRow).count() == 1
    assert db_session.get(HevyWorkoutRow, "workout-1").garmin_activity_ids == [
        "24833957297"
    ]


# --- backfill_workouts ---------------------------------------------------------


def test_backfill_workouts_upserts_pages_without_duplicates(db_session) -> None:
    user = _create_user(db_session)
    client = FakeHevyClient(
        workout_pages=[
            {
                "workouts": [
                    _raw_workout(
                        "workout-1",
                        start="2026-10-24T16:22:00+00:00",
                        end="2026-10-24T17:10:00+00:00",
                    ),
                    _raw_workout(
                        "workout-2",
                        start="2026-10-25T05:45:00+00:00",
                        end="2026-10-25T06:30:00+00:00",
                        title="Pull Day",
                    ),
                ],
                "page": 1,
                "page_count": 2,
            },
            {
                "workouts": [
                    _raw_workout(
                        "workout-3",
                        start="2026-10-26T16:00:00+00:00",
                        end="2026-10-26T16:40:00+00:00",
                        title="Leg Day",
                    )
                ],
                "page": 2,
                "page_count": 2,
            },
        ]
    )

    first = backfill_workouts(db_session, user.id, client)

    assert first == 3
    assert client.calls == ["get_workouts:1", "get_workouts:2"]
    rows = {row.id: row for row in db_session.query(HevyWorkoutRow).all()}
    assert set(rows) == {"workout-1", "workout-2", "workout-3"}
    assert rows["workout-1"].local_date == "2026-10-24"
    # 05:45 UTC → 07:45 SAST, same day.
    assert rows["workout-2"].local_date == "2026-10-25"
    assert rows["workout-2"].title == "Pull Day"

    # Re-running the backfill must not create duplicates.
    second = backfill_workouts(db_session, user.id, client)

    assert second == 3
    assert db_session.query(HevyWorkoutRow).count() == 3
