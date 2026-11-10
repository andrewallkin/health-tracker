from __future__ import annotations

import uuid
from datetime import datetime

import pytest
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.db_models import HevyExerciseTemplateRow, HevySyncStateRow, HevyWorkoutRow, UserRow


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


def test_hevy_tables_exist_after_metadata_create_all() -> None:
    engine = _make_engine()
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)

    table_columns = {
        table: {col["name"] for col in inspector.get_columns(table)}
        for table in ("hevy_exercise_templates", "hevy_workouts", "hevy_sync_state")
    }

    assert set(table_columns["hevy_exercise_templates"]) == {
        "id",
        "title",
        "type",
        "primary_muscle_group",
        "secondary_muscle_groups",
        "equipment",
        "is_custom",
        "thumbnail_url",
        "updated_at",
    }
    assert set(table_columns["hevy_workouts"]) == {
        "id",
        "user_id",
        "title",
        "start_time",
        "end_time",
        "routine_id",
        "local_date",
        "garmin_activity_ids",
        "payload",
        "updated_at",
    }
    assert set(table_columns["hevy_sync_state"]) == {
        "id",
        "user_id",
        "last_event_processed_at",
        "templates_synced_at",
        "updated_at",
    }


def test_hevy_workout_persists_garmin_activity_ids(db_session) -> None:
    user = _create_user(db_session)

    workout = HevyWorkoutRow(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title="Push Day",
        start_time=datetime(2026, 11, 10, 6, 30),
        end_time=datetime(2026, 11, 10, 7, 15),
        local_date="2026-11-10",
        garmin_activity_ids=["24833957297"],
        payload={"exercises": []},
    )
    db_session.add(workout)
    db_session.commit()

    row = db_session.get(HevyWorkoutRow, workout.id)
    assert row is not None
    assert row.garmin_activity_ids == ["24833957297"]
    assert row.payload == {"exercises": []}
    assert row.updated_at is not None


def test_hevy_workout_garmin_activity_ids_defaults_to_empty_list(db_session) -> None:
    user = _create_user(db_session)

    workout = HevyWorkoutRow(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title="Pull Day",
        start_time=datetime(2026, 11, 10, 6, 30),
        end_time=datetime(2026, 11, 10, 7, 15),
        local_date="2026-11-10",
        payload={},
    )
    db_session.add(workout)
    db_session.commit()

    row = db_session.get(HevyWorkoutRow, workout.id)
    assert row is not None
    assert row.garmin_activity_ids == []


def test_hevy_exercise_template_roundtrip(db_session) -> None:
    template = HevyExerciseTemplateRow(
        id="template-00000001",
        title="Barbell Bench Press",
        type="weight",
        primary_muscle_group="chest",
        secondary_muscle_groups=["triceps", "shoulders"],
        equipment="barbell",
        is_custom=False,
    )
    db_session.add(template)
    db_session.commit()

    row = db_session.get(HevyExerciseTemplateRow, template.id)
    assert row is not None
    assert row.title == "Barbell Bench Press"
    assert row.primary_muscle_group == "chest"
    assert row.secondary_muscle_groups == ["triceps", "shoulders"]
    assert row.equipment == "barbell"
    assert row.is_custom is False
    assert row.thumbnail_url is None
    assert row.updated_at is not None


def test_hevy_exercise_template_accepts_uuid_sized_id(db_session) -> None:
    # Real Hevy custom-exercise template ids are full UUIDs (36 chars); the
    # column must be wide enough for them (regression guard: width 64).
    assert HevyExerciseTemplateRow.__table__.c.id.type.length == 64

    template_id = str(uuid.uuid4())
    assert len(template_id) == 36

    template = HevyExerciseTemplateRow(
        id=template_id,
        title="Custom Cable Twist",
        type="weight",
        primary_muscle_group="core",
        secondary_muscle_groups=[],
        equipment="cable",
        is_custom=True,
        thumbnail_url="https://cdn.hevyapp.com/templates/twist.png",
    )
    db_session.add(template)
    db_session.commit()

    row = db_session.get(HevyExerciseTemplateRow, template_id)
    assert row is not None
    assert row.id == template_id
    assert row.is_custom is True


def test_hevy_sync_state_user_id_unique(db_session) -> None:
    user = _create_user(db_session)

    first = HevySyncStateRow(id=str(uuid.uuid4()), user_id=user.id)
    db_session.add(first)
    db_session.commit()

    duplicate = HevySyncStateRow(id=str(uuid.uuid4()), user_id=user.id)
    db_session.add(duplicate)
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_hevy_workout_user_cascade_delete(db_session) -> None:
    user = _create_user(db_session)
    workout = HevyWorkoutRow(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title="Leg Day",
        start_time=datetime(2026, 11, 10, 6, 30),
        end_time=datetime(2026, 11, 10, 7, 15),
        local_date="2026-11-10",
        payload={},
    )
    db_session.add(workout)
    db_session.commit()
    workout_id = workout.id

    db_session.query(UserRow).filter(UserRow.id == user.id).delete()
    db_session.commit()

    remaining = (
        db_session.query(HevyWorkoutRow)
        .filter(HevyWorkoutRow.id == workout_id)
        .count()
    )
    assert remaining == 0
