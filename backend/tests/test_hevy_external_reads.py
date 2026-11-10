"""Tests for the Hevy external read endpoints (service layer + routes).

Rows are seeded directly into a sqlite in-memory database (no Hevy client):
service functions are exercised against a plain session, and the HTTP surface
is verified through the FastAPI app with the shared external-api-key flow.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.api import hevy_service
from backend.database import Base, get_db
from backend.db_models import HevyExerciseTemplateRow, HevyWorkoutRow, UserRow
from backend.tests.conftest import register_user

UTC = timezone.utc

EXPECTED_MUSCLE_GROUPS = [
    "quadriceps",
    "chest",
    "abdominals",
    "full_body",
    "shoulders",
    "biceps",
    "glutes",
    "triceps",
    "upper_back",
    "lats",
    "cardio",
    "calves",
    "hamstrings",
    "forearms",
    "traps",
    "lower_back",
    "neck",
    "adductors",
    "abductors",
    "other",
]
EXPECTED_EQUIPMENT = [
    "machine",
    "none",
    "barbell",
    "dumbbell",
    "other",
    "kettlebell",
    "resistance_band",
    "plate",
    "suspension",
]
EXPECTED_EXERCISE_TYPES = [
    "weight_reps",
    "reps_only",
    "duration",
    "bodyweight_weighted",
    "distance_duration",
    "bodyweight_assisted",
    "short_distance_weight",
    "floors_duration",
    "steps_duration",
]
EXPECTED_SET_TYPES = ["warmup", "normal", "failure", "dropset"]


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


def _template(
    template_id: str,
    title: str,
    *,
    type_: str = "weight_reps",
    muscle: str = "chest",
    equipment: str = "barbell",
) -> HevyExerciseTemplateRow:
    return HevyExerciseTemplateRow(
        id=template_id,
        title=title,
        type=type_,
        primary_muscle_group=muscle,
        secondary_muscle_groups=[],
        equipment=equipment,
        is_custom=False,
        thumbnail_url=None,
    )


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


def _route_db(client: TestClient):
    gen = client.app.dependency_overrides[get_db]()
    return next(gen), gen


def _close_route_db(gen) -> None:
    try:
        next(gen)
    except StopIteration:
        pass


def _issue_key(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post("/api/settings/external-api-key", headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["apiKey"]


def external_headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"}


# --- list_hevy_workouts -------------------------------------------------------


def test_list_hevy_workouts_filters_range_orders_desc_and_limits(db_session) -> None:
    user = _create_user(db_session)
    _seed_workout(
        db_session, user.id, "w1",
        start_utc=datetime(2026, 10, 22, 18, 0, tzinfo=UTC),
        local_date="2026-10-22",
        exercises=[],
    )
    _seed_workout(
        db_session, user.id, "w2",
        start_utc=datetime(2026, 10, 24, 16, 22, tzinfo=UTC),
        local_date="2026-10-24",
        exercises=[],
    )
    _seed_workout(
        db_session, user.id, "w3",
        start_utc=datetime(2026, 10, 24, 22, 30, tzinfo=UTC),  # 00:30 SAST on 10-25
        local_date="2026-10-25",
        exercises=[],
    )

    all_rows = hevy_service.list_hevy_workouts(db_session, user.id)
    assert [row["id"] for row in all_rows] == ["w3", "w2", "w1"]

    assert [row["id"] for row in hevy_service.list_hevy_workouts(db_session, user.id, from_key="2026-10-24")] == [
        "w3",
        "w2",
    ]
    assert [row["id"] for row in hevy_service.list_hevy_workouts(db_session, user.id, to_key="2026-10-24")] == [
        "w2",
        "w1",
    ]
    assert [
        row["id"]
        for row in hevy_service.list_hevy_workouts(db_session, user.id, from_key="2026-10-24", to_key="2026-10-24")
    ] == ["w2"]
    assert [row["id"] for row in hevy_service.list_hevy_workouts(db_session, user.id, limit=2)] == ["w3", "w2"]

    summary = all_rows[0]
    assert summary["id"] == "w3"
    assert summary["title"] == "Push Day"
    assert summary["local_date"] == "2026-10-25"
    assert summary["start_time"] == "2026-10-24T22:30:00+00:00"
    assert summary["end_time"] == "2026-10-24T23:15:00+00:00"
    assert summary["routine_id"] is None
    assert summary["garmin_activity_ids"] == []
    assert summary["exercise_count"] == 0
    assert summary["set_count"] == 0


def test_hevy_workout_reads_are_scoped_to_the_owning_user(db_session) -> None:
    alice = _create_user(db_session)
    bob = _create_user(db_session)
    db_session.add(_template("55E6546F", "Barbell Bench Press"))
    db_session.commit()
    _seed_workout(
        db_session, alice.id, "w-alice",
        start_utc=datetime(2026, 10, 24, 16, 22, tzinfo=UTC),
        local_date="2026-10-24",
        exercises=[_exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=100, reps=5)])],
    )
    _seed_workout(
        db_session, bob.id, "w-bob",
        start_utc=datetime(2026, 10, 25, 16, 22, tzinfo=UTC),
        local_date="2026-10-25",
        exercises=[_exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=60, reps=8)])],
    )

    assert [row["id"] for row in hevy_service.list_hevy_workouts(db_session, alice.id)] == ["w-alice"]
    assert hevy_service.get_hevy_workout(db_session, alice.id, "w-bob") is None

    alice_prs = hevy_service.exercise_prs(db_session, alice.id)
    assert len(alice_prs) == 1
    assert alice_prs[0]["pr"]["value"] == 100.0  # Bob's 60 kg set must not leak in
    assert alice_prs[0]["history_count"] == 1

    alice_progression = hevy_service.exercise_progression(db_session, alice.id, "55E6546F")
    assert [entry["workout_id"] for entry in alice_progression] == ["w-alice"]


# --- get_hevy_workout ---------------------------------------------------------


def test_get_hevy_workout_returns_full_payload_detail(db_session) -> None:
    user = _create_user(db_session)
    exercises = [
        _exercise(
            0,
            "55E6546F",
            "Barbell Bench Press",
            [_set(0, weight_kg=100, reps=5), _set(1, weight_kg=90, reps=8, type="warmup")],
        )
    ]
    _seed_workout(
        db_session, user.id, "w-detail",
        start_utc=datetime(2026, 10, 24, 16, 22, tzinfo=UTC),
        local_date="2026-10-24",
        exercises=exercises,
    )

    detail = hevy_service.get_hevy_workout(db_session, user.id, "w-detail")

    assert detail is not None
    assert detail["id"] == "w-detail"
    assert detail["title"] == "Push Day"
    assert detail["description"] == "Hard session"
    assert detail["local_date"] == "2026-10-24"
    assert detail["start_time"] == "2026-10-24T16:22:00+00:00"
    assert detail["end_time"] == "2026-10-24T17:07:00+00:00"
    assert detail["exercise_count"] == 1
    assert detail["set_count"] == 2
    assert detail["exercises"][0]["exercise_template_id"] == "55E6546F"
    assert detail["exercises"][0]["sets"][1]["type"] == "warmup"

    assert hevy_service.get_hevy_workout(db_session, user.id, "missing") is None


# --- list_hevy_exercises ------------------------------------------------------


def test_list_hevy_exercises_filters_are_case_insensitive(db_session) -> None:
    db_session.add_all(
        [
            _template("BENCH001", "Barbell Bench Press"),
            _template("PULL0001", "Lat Pulldown", muscle="lats", equipment="machine"),
            _template("TEST0001", "Air Bike", type_="duration", muscle="cardio", equipment="none"),
            _template("INCL0001", "Incline Dumbbell Press", muscle="chest", equipment="dumbbell"),
        ]
    )
    db_session.commit()

    assert len(hevy_service.list_hevy_exercises(db_session)) == 4
    assert [t["id"] for t in hevy_service.list_hevy_exercises(db_session, muscle_group="LATS")] == ["PULL0001"]
    assert [t["id"] for t in hevy_service.list_hevy_exercises(db_session, muscle_group="Chest")] == [
        "BENCH001",
        "INCL0001",
    ]
    assert [t["id"] for t in hevy_service.list_hevy_exercises(db_session, equipment="Machine")] == ["PULL0001"]
    assert [t["id"] for t in hevy_service.list_hevy_exercises(db_session, type_="DURATION")] == ["TEST0001"]
    assert [t["id"] for t in hevy_service.list_hevy_exercises(db_session, search="PRESS")] == [
        "BENCH001",
        "INCL0001",
    ]
    assert [t["id"] for t in hevy_service.list_hevy_exercises(db_session, muscle_group="chest", search="dumbbell")] == [
        "INCL0001"
    ]

    template = hevy_service.list_hevy_exercises(db_session, muscle_group="lats")[0]
    assert template == {
        "id": "PULL0001",
        "title": "Lat Pulldown",
        "type": "weight_reps",
        "primary_muscle_group": "lats",
        "secondary_muscle_groups": [],
        "equipment": "machine",
        "is_custom": False,
        "thumbnail_url": None,
    }


# --- hevy_metadata ------------------------------------------------------------


def test_hevy_metadata_lists_observed_catalogue_values() -> None:
    metadata = hevy_service.hevy_metadata()

    assert metadata["muscle_groups"] == EXPECTED_MUSCLE_GROUPS
    assert metadata["equipment"] == EXPECTED_EQUIPMENT
    assert metadata["exercise_types"] == EXPECTED_EXERCISE_TYPES
    assert metadata["set_types"] == EXPECTED_SET_TYPES
    assert isinstance(metadata["id_formats"], str) and metadata["id_formats"]


# --- exercise_progression -----------------------------------------------------


def test_exercise_progression_weight_math_merges_entries_and_orders_chronologically(db_session) -> None:
    user = _create_user(db_session)
    db_session.add(_template("55E6546F", "Barbell Bench Press"))
    db_session.commit()
    _seed_workout(
        db_session, user.id, "w1",
        start_utc=datetime(2026, 10, 20, 16, 0, tzinfo=UTC),
        local_date="2026-10-20",
        exercises=[
            _exercise(
                0,
                "55E6546F",
                "Barbell Bench Press",
                [_set(0, weight_kg=100, reps=5), _set(1, weight_kg=90, reps=8)],
            ),
            _exercise(1, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=80, reps=10)]),
        ],
    )
    _seed_workout(
        db_session, user.id, "w2",
        start_utc=datetime(2026, 10, 24, 16, 0, tzinfo=UTC),
        local_date="2026-10-24",
        exercises=[_exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=105, reps=3)])],
    )

    sessions = hevy_service.exercise_progression(db_session, user.id, "55E6546F")

    # 100×5 → e1RM 100 * (1 + 5/30) = 116.67 (2dp); entries within one session merge.
    assert sessions == [
        {
            "date": "2026-10-20",
            "workout_id": "w1",
            "n_sets": 3,
            "best_e1rm": 116.67,
            "top_weight": 100.0,
            "total_volume_kg": 2020.0,
        },
        {
            "date": "2026-10-24",
            "workout_id": "w2",
            "n_sets": 1,
            "best_e1rm": 115.5,
            "top_weight": 105.0,
            "total_volume_kg": 315.0,
        },
    ]


def test_exercise_progression_range_filters_and_missing_template(db_session) -> None:
    user = _create_user(db_session)
    db_session.add(_template("55E6546F", "Barbell Bench Press"))
    db_session.add(_template("ROWE0001", "Barbell Row", muscle="lats"))
    db_session.commit()
    for workout_id, day in (("w1", "2026-10-20"), ("w2", "2026-10-24"), ("w3", "2026-10-27")):
        _seed_workout(
            db_session, user.id, workout_id,
            start_utc=datetime(2026, 10, int(day[-2:]), 16, 0, tzinfo=UTC),
            local_date=day,
            exercises=[_exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=100, reps=5)])],
        )

    progression = hevy_service.exercise_progression(db_session, user.id, "55E6546F")
    assert [entry["workout_id"] for entry in progression] == ["w1", "w2", "w3"]
    assert [entry["workout_id"] for entry in hevy_service.exercise_progression(db_session, user.id, "55E6546F", from_key="2026-10-24")] == [
        "w2",
        "w3",
    ]
    assert [entry["workout_id"] for entry in hevy_service.exercise_progression(db_session, user.id, "55E6546F", to_key="2026-10-24")] == [
        "w1",
        "w2",
    ]
    only_w2 = hevy_service.exercise_progression(db_session, user.id, "55E6546F", from_key="2026-10-24", to_key="2026-10-24")
    assert [entry["workout_id"] for entry in only_w2] == ["w2"]

    # Known template never trained → empty series; unknown template → None (route 404s).
    assert hevy_service.exercise_progression(db_session, user.id, "ROWE0001") == []
    assert hevy_service.exercise_progression(db_session, user.id, "ZZZZZZZZ") is None


def test_exercise_progression_duration_and_distance_types(db_session) -> None:
    user = _create_user(db_session)
    db_session.add(_template("TEST0001", "Air Bike", type_="duration", muscle="cardio", equipment="none"))
    db_session.add(_template("DIST0001", "RowErg", type_="distance_duration", muscle="cardio", equipment="none"))
    db_session.commit()
    _seed_workout(
        db_session, user.id, "w1",
        start_utc=datetime(2026, 10, 21, 16, 0, tzinfo=UTC),
        local_date="2026-10-21",
        exercises=[
            _exercise(0, "TEST0001", "Air Bike", [_set(0, duration_seconds=1800), _set(1, duration_seconds=2400)])
        ],
    )
    _seed_workout(
        db_session, user.id, "w2",
        start_utc=datetime(2026, 10, 22, 16, 0, tzinfo=UTC),
        local_date="2026-10-22",
        exercises=[_exercise(0, "DIST0001", "RowErg", [_set(0, distance_meters=5000, duration_seconds=1200)])],
    )

    bike = hevy_service.exercise_progression(db_session, user.id, "TEST0001")
    assert bike == [
        {"date": "2026-10-21", "workout_id": "w1", "n_sets": 2, "best_duration_seconds": 2400}
    ]

    erg = hevy_service.exercise_progression(db_session, user.id, "DIST0001")
    assert erg == [
        {
            "date": "2026-10-22",
            "workout_id": "w2",
            "n_sets": 1,
            "best_duration_seconds": 1200,
            "best_distance_meters": 5000,
        }
    ]


# --- exercise_prs -------------------------------------------------------------


def test_exercise_prs_select_max_across_sessions(db_session) -> None:
    user = _create_user(db_session)
    db_session.add(_template("55E6546F", "Barbell Bench Press"))
    db_session.add(_template("TEST0001", "Air Bike", type_="duration", muscle="cardio", equipment="none"))
    db_session.add(_template("DIST0001", "RowErg", type_="distance_duration", muscle="cardio", equipment="none"))
    db_session.commit()
    _seed_workout(
        db_session, user.id, "p1",
        start_utc=datetime(2026, 10, 20, 16, 0, tzinfo=UTC),
        local_date="2026-10-20",
        exercises=[_exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=100, reps=5)])],
    )
    _seed_workout(
        db_session, user.id, "p2",
        start_utc=datetime(2026, 10, 24, 16, 0, tzinfo=UTC),
        local_date="2026-10-24",
        exercises=[_exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=105, reps=3)])],
    )
    _seed_workout(
        db_session, user.id, "p3",
        start_utc=datetime(2026, 10, 27, 16, 0, tzinfo=UTC),
        local_date="2026-10-27",
        exercises=[_exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=102.5, reps=2)])],
    )
    _seed_workout(
        db_session, user.id, "p4",
        start_utc=datetime(2026, 10, 21, 16, 0, tzinfo=UTC),
        local_date="2026-10-21",
        exercises=[_exercise(0, "TEST0001", "Air Bike", [_set(0, duration_seconds=1800)])],
    )
    _seed_workout(
        db_session, user.id, "p5",
        start_utc=datetime(2026, 10, 23, 16, 0, tzinfo=UTC),
        local_date="2026-10-23",
        exercises=[_exercise(0, "TEST0001", "Air Bike", [_set(0, duration_seconds=2400)])],
    )
    _seed_workout(
        db_session, user.id, "p6",
        start_utc=datetime(2026, 10, 22, 16, 0, tzinfo=UTC),
        local_date="2026-10-22",
        exercises=[_exercise(0, "DIST0001", "RowErg", [_set(0, distance_meters=5000, duration_seconds=1200)])],
    )

    prs = hevy_service.exercise_prs(db_session, user.id)

    # Entries sorted by title: Air Bike < Barbell Bench Press < RowErg.
    assert [pr["template_id"] for pr in prs] == ["TEST0001", "55E6546F", "DIST0001"]

    bench = prs[1]
    assert bench["title"] == "Barbell Bench Press"
    # Max weight lands on p2, but the best e1RM (116.67) lands on p1 — both kept.
    assert bench["pr"] == {"metric": "weight_kg", "value": 105.0, "date": "2026-10-24"}
    assert bench["best_e1rm"] == {"value": 116.67, "date": "2026-10-20"}
    assert bench["history_count"] == 3

    bike = prs[0]
    assert bike["pr"] == {"metric": "duration_seconds", "value": 2400, "date": "2026-10-23"}
    assert bike["history_count"] == 2
    assert "best_e1rm" not in bike

    erg = prs[2]
    assert erg["pr"] == {"metric": "distance_meters", "value": 5000, "date": "2026-10-22"}
    assert erg["history_count"] == 1
    assert "best_e1rm" not in erg


# --- exercise_habits ----------------------------------------------------------


def test_exercise_habits_counts_sessions_and_equipment(db_session) -> None:
    user = _create_user(db_session)
    db_session.add(_template("55E6546F", "Barbell Bench Press"))
    db_session.add(_template("ROWE0001", "Barbell Row", muscle="lats"))
    db_session.add(_template("TEST0001", "Air Bike", type_="duration", muscle="cardio", equipment="none"))
    db_session.commit()
    _seed_workout(
        db_session, user.id, "w1",
        start_utc=datetime(2026, 10, 20, 16, 0, tzinfo=UTC),
        local_date="2026-10-20",
        exercises=[
            _exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=100, reps=5)]),
            _exercise(1, "ROWE0001", "Barbell Row", [_set(0, weight_kg=60, reps=10)]),
        ],
    )
    # Same exercise logged twice in one workout counts the session once.
    _seed_workout(
        db_session, user.id, "w2",
        start_utc=datetime(2026, 10, 22, 16, 0, tzinfo=UTC),
        local_date="2026-10-22",
        exercises=[
            _exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=100, reps=5)]),
            _exercise(1, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=90, reps=8)]),
        ],
    )
    _seed_workout(
        db_session, user.id, "w3",
        start_utc=datetime(2026, 10, 24, 16, 0, tzinfo=UTC),
        local_date="2026-10-24",
        exercises=[_exercise(0, "TEST0001", "Air Bike", [_set(0, duration_seconds=1800)])],
    )

    habits = hevy_service.exercise_habits(db_session, user.id)

    assert habits["exercises"] == [
        {"template_id": "55E6546F", "title": "Barbell Bench Press", "count": 2},
        {"template_id": "TEST0001", "title": "Air Bike", "count": 1},
        {"template_id": "ROWE0001", "title": "Barbell Row", "count": 1},
    ]
    assert habits["equipment_profile"] == [
        {"equipment": "barbell", "count": 3},
        {"equipment": "none", "count": 1},
    ]

    ranged = hevy_service.exercise_habits(db_session, user.id, from_key="2026-10-22")
    assert ranged["exercises"] == [
        {"template_id": "TEST0001", "title": "Air Bike", "count": 1},
        {"template_id": "55E6546F", "title": "Barbell Bench Press", "count": 1},
    ]
    assert ranged["equipment_profile"] == [
        {"equipment": "barbell", "count": 1},
        {"equipment": "none", "count": 1},
    ]


# --- routes -------------------------------------------------------------------


def test_hevy_routes_require_external_api_key(client) -> None:
    assert client.get("/api/external/hevy/workouts").status_code == 401
    assert client.get("/api/external/hevy/metadata").status_code == 401


def test_hevy_routes_serve_seeded_rows(client) -> None:
    headers = register_user(client, "hevy-routes@example.com")
    api_key = _issue_key(client, headers)
    user_id = client.get("/api/users/me", headers=headers).json()["id"]

    db, gen = _route_db(client)
    try:
        db.add(_template("55E6546F", "Barbell Bench Press"))
        _seed_workout(
            db, user_id, "w-route",
            start_utc=datetime(2026, 10, 24, 16, 22, tzinfo=UTC),
            local_date="2026-10-24",
            exercises=[_exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=100, reps=5)])],
        )
        db.commit()
    finally:
        _close_route_db(gen)

    auth = external_headers(api_key)

    workouts = client.get("/api/external/hevy/workouts", headers=auth)
    assert workouts.status_code == 200
    assert [row["id"] for row in workouts.json()] == ["w-route"]
    assert client.get("/api/external/hevy/workouts?limit=0", headers=auth).status_code == 400
    assert client.get("/api/external/hevy/workouts?limit=201", headers=auth).status_code == 400

    detail = client.get("/api/external/hevy/workouts/w-route", headers=auth)
    assert detail.status_code == 200
    assert detail.json()["exercises"][0]["sets"][0]["weight_kg"] == 100
    assert client.get("/api/external/hevy/workouts/missing-id", headers=auth).status_code == 404

    exercises = client.get("/api/external/hevy/exercises", headers=auth)
    assert exercises.status_code == 200
    assert [t["id"] for t in exercises.json()] == ["55E6546F"]

    metadata = client.get("/api/external/hevy/metadata", headers=auth)
    assert metadata.status_code == 200
    assert metadata.json()["muscle_groups"] == EXPECTED_MUSCLE_GROUPS

    progression = client.get("/api/external/hevy/exercises/55E6546F/progression", headers=auth)
    assert progression.status_code == 200
    assert progression.json() == [
        {
            "date": "2026-10-24",
            "workout_id": "w-route",
            "n_sets": 1,
            "best_e1rm": 116.67,
            "top_weight": 100.0,
            "total_volume_kg": 500.0,
        }
    ]
    assert client.get("/api/external/hevy/exercises/ZZZZZZZZ/progression", headers=auth).status_code == 404

    prs = client.get("/api/external/hevy/prs", headers=auth)
    assert prs.status_code == 200
    assert prs.json()[0]["pr"] == {"metric": "weight_kg", "value": 100.0, "date": "2026-10-24"}
    assert "best_e1rm" in prs.json()[0]

    habits = client.get("/api/external/hevy/habits", headers=auth)
    assert habits.status_code == 200
    assert habits.json()["exercises"] == [
        {"template_id": "55E6546F", "title": "Barbell Bench Press", "count": 1}
    ]
    assert habits.json()["equipment_profile"] == [{"equipment": "barbell", "count": 1}]


def test_hevy_routes_hide_other_users_workouts(client) -> None:
    alice_headers = register_user(client, "hevy-alice@example.com")
    alice_key = _issue_key(client, alice_headers)
    alice_id = client.get("/api/users/me", headers=alice_headers).json()["id"]
    bob_headers = register_user(client, "hevy-bob@example.com")
    bob_key = _issue_key(client, bob_headers)
    bob_id = client.get("/api/users/me", headers=bob_headers).json()["id"]

    db, gen = _route_db(client)
    try:
        db.add(_template("55E6546F", "Barbell Bench Press"))
        _seed_workout(
            db, alice_id, "w-alice",
            start_utc=datetime(2026, 10, 24, 16, 22, tzinfo=UTC),
            local_date="2026-10-24",
            exercises=[_exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=100, reps=5)])],
        )
        _seed_workout(
            db, bob_id, "w-bob",
            start_utc=datetime(2026, 10, 25, 16, 22, tzinfo=UTC),
            local_date="2026-10-25",
            exercises=[_exercise(0, "55E6546F", "Barbell Bench Press", [_set(0, weight_kg=60, reps=8)])],
        )
        db.commit()
    finally:
        _close_route_db(gen)

    alice_auth = external_headers(alice_key)
    bob_auth = external_headers(bob_key)

    assert [row["id"] for row in client.get("/api/external/hevy/workouts", headers=alice_auth).json()] == ["w-alice"]
    assert client.get("/api/external/hevy/workouts/w-alice", headers=bob_auth).status_code == 404

    alice_prs = client.get("/api/external/hevy/prs", headers=alice_auth).json()
    assert alice_prs[0]["history_count"] == 1
    assert alice_prs[0]["pr"]["value"] == 100.0  # Bob's 60 kg session must not leak in
