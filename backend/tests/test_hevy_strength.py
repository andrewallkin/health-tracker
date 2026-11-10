"""Tests for the day-strength block built from Hevy workout rows.

Rows are seeded directly into a sqlite in-memory database (no Hevy client):
``build_strength_block`` aggregates a day's workouts into per-session volume
and hard-set counts, and ``_health_block`` attaches the block when non-None.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.api.external_service import _health_block
from backend.api.hevy_strength import build_strength_block, count_hard_sets
from backend.api.schemas import DailyHealth
from backend.database import Base
from backend.db_models import HevyWorkoutRow, UserRow
from backend.tests.test_health_api import health_payload

UTC = timezone.utc


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


def _set(index: int, **fields) -> dict:
    base = {
        "index": index,
        "type": "normal",
        "weight_kg": None,
        "reps": None,
        "distance_meters": None,
        "duration_seconds": None,
        "rpe": None,
        "custom_metric": None,
        "rep_range": None,
    }
    base.update(fields)
    return base


def _exercise(index: int, template_id: str, title: str, sets: list[dict]) -> dict:
    return {
        "index": index,
        "title": title,
        "exercise_template_id": template_id,
        "superset_id": None,
        "rest_seconds": None,
        "notes": None,
        "sets": sets,
    }


def _seed_workout(
    db,
    user_id: str,
    workout_id: str,
    *,
    start_utc: datetime,
    local_date: str,
    exercises: list[dict],
    title: str = "Push Day",
) -> HevyWorkoutRow:
    """Mirror the sync layer's row shape: columns for time logic, payload for detail."""
    end_utc = start_utc + timedelta(minutes=45)
    row = HevyWorkoutRow(
        id=workout_id,
        user_id=user_id,
        title=title,
        start_time=start_utc,
        end_time=end_utc,
        local_date=local_date,
        garmin_activity_ids=[],
        payload={
            "id": workout_id,
            "title": title,
            "routine_id": None,
            "description": "Hard session",
            "start_time": start_utc.isoformat(),
            "end_time": end_utc.isoformat(),
            "exercises": exercises,
        },
    )
    db.add(row)
    db.commit()
    return row


# --- build_strength_block -----------------------------------------------------


def test_build_strength_block_returns_none_without_workouts(db_session) -> None:
    user = _create_user(db_session)

    assert build_strength_block(db_session, user.id, "2026-11-10") is None


def test_build_strength_block_is_user_scoped(db_session) -> None:
    owner = _create_user(db_session)
    other = _create_user(db_session)
    _seed_workout(
        db_session,
        owner.id,
        "w1",
        start_utc=datetime(2026, 11, 9, 22, 30, tzinfo=UTC),
        local_date="2026-11-10",
        exercises=[_exercise(0, "55E6546F", "Bent Over Row (Barbell)", [_set(0, weight_kg=40.0, reps=10)])],
    )

    assert build_strength_block(db_session, other.id, "2026-11-10") is None


def test_build_strength_block_volume_and_counts_exact(db_session) -> None:
    user = _create_user(db_session)
    _seed_workout(
        db_session,
        user.id,
        "w1",
        start_utc=datetime(2026, 11, 9, 22, 30, tzinfo=UTC),
        local_date="2026-11-10",
        exercises=[
            _exercise(
                0,
                "55E6546F",
                "Bent Over Row (Barbell)",
                [_set(index, weight_kg=40.0, reps=10) for index in range(3)],
            )
        ],
    )

    block = build_strength_block(db_session, user.id, "2026-11-10")

    assert block is not None
    assert block["total_volume_kg"] == 1200.0
    assert block["hard_sets"] == 3  # equal top sets all count
    assert len(block["sessions"]) == 1
    session = block["sessions"][0]
    assert session["workout_id"] == "w1"
    assert session["title"] == "Push Day"
    assert session["start_time"] == "2026-11-09T22:30:00+00:00"
    assert session["end_time"] == "2026-11-09T23:15:00+00:00"
    assert session["garmin_activity_ids"] == []
    assert session["total_volume_kg"] == 1200.0
    assert session["hard_sets"] == 3
    assert session["n_exercises"] == 1


def test_rpe_nine_set_counts_as_hard_set(db_session) -> None:
    user = _create_user(db_session)
    _seed_workout(
        db_session,
        user.id,
        "w1",
        start_utc=datetime(2026, 11, 9, 22, 30, tzinfo=UTC),
        local_date="2026-11-10",
        exercises=[
            _exercise(
                0,
                "55E6546F",
                "Bent Over Row (Barbell)",
                [
                    _set(0, weight_kg=40.0, reps=10),
                    _set(1, weight_kg=40.0, reps=10, rpe=9),
                ],
            )
        ],
    )

    block = build_strength_block(db_session, user.id, "2026-11-10")

    assert block is not None
    assert block["total_volume_kg"] == 800.0
    assert block["hard_sets"] == 2  # top-set tie + the rpe 9 set


def test_build_strength_block_orders_sessions_and_sums_totals(db_session) -> None:
    user = _create_user(db_session)
    # 2026-11-09T22:30Z == 00:30 SAST on 2026-11-10; 2026-11-10T17:00Z == 19:00 SAST.
    _seed_workout(
        db_session,
        user.id,
        "w-morning",
        start_utc=datetime(2026, 11, 9, 22, 30, tzinfo=UTC),
        local_date="2026-11-10",
        exercises=[_exercise(0, "55E6546F", "Bent Over Row (Barbell)", [_set(0, weight_kg=40.0, reps=10)])],
        title="Morning",
    )
    _seed_workout(
        db_session,
        user.id,
        "w-evening",
        start_utc=datetime(2026, 11, 10, 17, 0, tzinfo=UTC),
        local_date="2026-11-10",
        exercises=[_exercise(0, "55E6546F", "Bent Over Row (Barbell)", [_set(0, weight_kg=60.0, reps=5)])],
        title="Evening",
    )

    block = build_strength_block(db_session, user.id, "2026-11-10")

    assert block is not None
    assert [session["workout_id"] for session in block["sessions"]] == ["w-morning", "w-evening"]
    assert [session["title"] for session in block["sessions"]] == ["Morning", "Evening"]
    assert block["total_volume_kg"] == 700.0  # 400 + 300
    assert block["hard_sets"] == 2  # each session's single top set


def test_warmup_sets_contribute_no_volume_or_hard_sets(db_session) -> None:
    user = _create_user(db_session)
    _seed_workout(
        db_session,
        user.id,
        "w1",
        start_utc=datetime(2026, 11, 9, 22, 30, tzinfo=UTC),
        local_date="2026-11-10",
        exercises=[
            _exercise(
                0,
                "55E6546F",
                "Bent Over Row (Barbell)",
                [
                    _set(0, type="warmup", weight_kg=20.0, reps=15),
                    _set(1, weight_kg=40.0, reps=10),
                ],
            )
        ],
    )

    block = build_strength_block(db_session, user.id, "2026-11-10")

    assert block is not None
    assert block["total_volume_kg"] == 400.0
    assert block["hard_sets"] == 1


def test_cardio_sets_contribute_duration_only_no_volume(db_session) -> None:
    user = _create_user(db_session)
    _seed_workout(
        db_session,
        user.id,
        "w1",
        start_utc=datetime(2026, 11, 9, 22, 30, tzinfo=UTC),
        local_date="2026-11-10",
        exercises=[_exercise(0, "TEST0001", "Air Bike", [_set(0, duration_seconds=600)])],
        title="Cardio finisher",
    )

    block = build_strength_block(db_session, user.id, "2026-11-10")

    assert block is not None
    assert block["total_volume_kg"] == 0.0
    assert block["hard_sets"] == 0
    session = block["sessions"][0]
    assert session["total_volume_kg"] == 0.0
    assert session["hard_sets"] == 0
    assert session["n_exercises"] == 1


# --- count_hard_sets: the locked hard-set rule --------------------------------


def test_count_hard_sets_locked_rule() -> None:
    exercises = [
        _exercise(
            0,
            "T1",
            "Bench Press",
            [
                _set(0, type="warmup", weight_kg=100.0, reps=8),  # warmup: never hard
                _set(1, weight_kg=80.0, reps=8),  # top set by weight: hard
                _set(2, weight_kg=70.0, reps=8),  # not top, no rpe: not hard
                _set(3, type="failure", weight_kg=60.0, reps=8),  # failure: hard
            ],
        ),
        _exercise(
            1,
            "T2",
            "Row",
            [
                _set(0, weight_kg=40.0, reps=10, rpe=8),  # rpe == 8 counts (>= 8)
                _set(1, weight_kg=40.0, reps=10, rpe=7.5),  # explicit rpe < 8: never hard
            ],
        ),
        _exercise(2, "T3", "Air Bike", [_set(0, duration_seconds=600)]),  # cardio set
    ]

    assert count_hard_sets(exercises) == 3


def test_count_hard_sets_counts_rpe_nine() -> None:
    exercises = [_exercise(0, "T1", "Bench Press", [_set(0, weight_kg=40.0, reps=10, rpe=9)])]

    assert count_hard_sets(exercises) == 1


def test_count_hard_sets_tied_top_sets_all_count() -> None:
    exercises = [
        _exercise(0, "T1", "Bench Press", [_set(0, weight_kg=100.0, reps=5), _set(1, weight_kg=100.0, reps=5)])
    ]

    assert count_hard_sets(exercises) == 2


def test_count_hard_sets_warmup_never_shadows_work_sets() -> None:
    exercises = [
        _exercise(
            0,
            "T1",
            "Bench Press",
            [
                _set(0, type="warmup", weight_kg=100.0, reps=8),
                _set(1, weight_kg=80.0, reps=8),
            ],
        )
    ]

    assert count_hard_sets(exercises) == 1  # work set is the top non-warmup set


# --- _health_block attaches the strength block --------------------------------


def test_health_block_unavailable_branch_includes_strength(db_session) -> None:
    user = _create_user(db_session)
    _seed_workout(
        db_session,
        user.id,
        "w1",
        start_utc=datetime(2026, 11, 9, 22, 30, tzinfo=UTC),
        local_date="2026-11-10",
        exercises=[_exercise(0, "55E6546F", "Bent Over Row (Barbell)", [_set(0, weight_kg=40.0, reps=10)])],
    )

    block = _health_block(db_session, user.id, "2026-11-10", None, "disconnected")

    assert block["status"] == "unavailable"
    assert block["reason"] == "disconnected"
    assert block["strength"] is not None
    assert block["strength"]["total_volume_kg"] == 400.0
    assert block["strength"]["hard_sets"] == 1


def test_health_block_unavailable_branch_without_strength_omits_key(db_session) -> None:
    user = _create_user(db_session)

    block = _health_block(db_session, user.id, "2026-11-10", None, "disconnected")

    assert block == {"status": "unavailable", "reason": "disconnected"}
    assert "strength" not in block


def test_health_block_ready_branch_includes_strength(db_session) -> None:
    user = _create_user(db_session)
    day = DailyHealth.model_validate(health_payload("2026-11-10", steps=9000))
    _seed_workout(
        db_session,
        user.id,
        "w1",
        start_utc=datetime(2026, 11, 9, 22, 30, tzinfo=UTC),
        local_date="2026-11-10",
        exercises=[_exercise(0, "55E6546F", "Bent Over Row (Barbell)", [_set(0, weight_kg=40.0, reps=10)])],
    )

    block = _health_block(db_session, user.id, "2026-11-10", day, None)

    assert block["status"] == "ready"
    assert block["steps"] == 9000
    assert block["strength"]["hard_sets"] == 1
    assert block["strength"]["total_volume_kg"] == 400.0
