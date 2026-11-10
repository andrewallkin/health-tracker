from __future__ import annotations

import copy
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from backend.hevy_schemas import (
    HevyExerciseTemplate,
    HevySet,
    HevyWorkout,
    normalize_workout,
)

UTC = timezone.utc

# Real payload shape captured during hevy_api discovery (single-set sample
# extended to the 3 sets the lifter actually performed).
SAMPLE_WORKOUT: dict = {
    "id": "05fcaa01-d0ec-4206-bd4e-a47585915642",
    "title": "Afternoon workout 💪",
    "routine_id": None,
    "description": "",
    "start_time": "2025-11-27T13:13:23+00:00",
    "end_time": "2025-11-27T14:06:01+00:00",
    "updated_at": "2025-11-27T14:06:05.703Z",
    "exercises": [
        {
            "index": 0,
            "title": "Bent Over Row (Barbell)",
            "notes": None,
            "exercise_template_id": "55E6546F",
            "superset_id": 0,
            "sets": [
                {
                    "index": index,
                    "type": "normal",
                    "weight_kg": 40,
                    "reps": 10,
                    "distance_meters": None,
                    "duration_seconds": None,
                    "rpe": None,
                    "custom_metric": None,
                }
                for index in range(3)
            ],
        }
    ],
}

AIR_BIKE_WORKOUT: dict = {
    **SAMPLE_WORKOUT,
    "id": "air-bike-workout",
    "title": "Cardio finisher",
    "exercises": [
        {
            "index": 0,
            "title": "Air Bike",
            "notes": None,
            "exercise_template_id": "TEST0001",
            "superset_id": None,
            "sets": [
                {
                    "index": 0,
                    "type": "normal",
                    "weight_kg": None,
                    "reps": None,
                    "distance_meters": None,
                    "duration_seconds": 600,
                    "rpe": None,
                    "custom_metric": None,
                }
            ],
        }
    ],
}

SAMPLE_TEMPLATE: dict = {
    "id": "55E6546F",
    "title": "Bent Over Row (Barbell)",
    "type": "weight & rep",
    "primary_muscle_group": "lats",
    "secondary_muscle_groups": ["biceps"],
    "equipment": "barbell",
    "is_custom": False,
    "thumbnail_url": None,
}


def test_parse_sample_workout_from_discovery():
    workout = HevyWorkout.model_validate(SAMPLE_WORKOUT)

    assert workout.id == "05fcaa01-d0ec-4206-bd4e-a47585915642"
    assert workout.title == "Afternoon workout 💪"
    assert workout.routine_id is None
    assert workout.description == ""
    assert workout.start_time == datetime(2025, 11, 27, 13, 13, 23, tzinfo=UTC)
    assert workout.end_time == datetime(2025, 11, 27, 14, 6, 1, tzinfo=UTC)
    assert workout.updated_at == datetime(2025, 11, 27, 14, 6, 5, 703000, tzinfo=UTC)

    assert len(workout.exercises) == 1
    exercise = workout.exercises[0]
    assert exercise.index == 0
    assert exercise.title == "Bent Over Row (Barbell)"
    assert exercise.exercise_template_id == "55E6546F"
    assert exercise.superset_id == 0
    assert exercise.rest_seconds is None
    assert exercise.notes is None

    assert len(exercise.sets) == 3
    for index, hevy_set in enumerate(exercise.sets):
        assert hevy_set.index == index
        assert hevy_set.type == "normal"
        assert hevy_set.weight_kg == 40.0
        assert hevy_set.reps == 10
        assert hevy_set.duration_seconds is None
        assert hevy_set.rep_range is None


def test_parse_hevy_datetime_handles_both_formats():
    assert HevyWorkout.parse_hevy_datetime("2025-11-27T13:13:23+00:00") == datetime(
        2025, 11, 27, 13, 13, 23, tzinfo=UTC
    )
    assert HevyWorkout.parse_hevy_datetime("2025-11-27T14:06:05.703Z") == datetime(
        2025, 11, 27, 14, 6, 5, 703000, tzinfo=UTC
    )


def test_air_bike_duration_set():
    workout = HevyWorkout.model_validate(AIR_BIKE_WORKOUT)

    exercise = workout.exercises[0]
    assert exercise.title == "Air Bike"
    assert exercise.superset_id is None

    hevy_set = exercise.sets[0]
    assert hevy_set.duration_seconds == 600
    assert hevy_set.weight_kg is None
    assert hevy_set.reps is None
    assert hevy_set.distance_meters is None
    assert hevy_set.rpe is None
    assert hevy_set.custom_metric is None


def test_extra_unknown_fields_are_ignored():
    raw = copy.deepcopy(SAMPLE_WORKOUT)
    raw["some_future_field"] = {"nested": True}
    raw["exercises"][0]["sets"][0]["future_set_field"] = 1

    workout = HevyWorkout.model_validate(raw)

    dumped = workout.model_dump()
    assert "some_future_field" not in dumped
    assert "future_set_field" not in dumped["exercises"][0]["sets"][0]


def test_set_rep_range_round_trip():
    hevy_set = HevySet.model_validate(
        {
            "index": 0,
            "type": "normal",
            "weight_kg": 40,
            "reps": 10,
            "rep_range": {"start": 8, "end": 12},
        }
    )

    assert hevy_set.rep_range == {"start": 8, "end": 12}


def test_set_type_defaults_to_normal():
    hevy_set = HevySet.model_validate({"index": 0, "weight_kg": 40, "reps": 10})

    assert hevy_set.type == "normal"


def test_parse_exercise_template():
    raw = {**SAMPLE_TEMPLATE, "future_template_field": "x"}

    template = HevyExerciseTemplate.model_validate(raw)

    assert template.id == "55E6546F"
    assert template.title == "Bent Over Row (Barbell)"
    assert template.type == "weight & rep"
    assert template.primary_muscle_group == "lats"
    assert template.secondary_muscle_groups == ["biceps"]
    assert template.equipment == "barbell"
    assert template.is_custom is False
    assert template.thumbnail_url is None


def test_missing_required_field_raises():
    raw = {**SAMPLE_WORKOUT}
    del raw["start_time"]

    with pytest.raises(ValidationError):
        HevyWorkout.model_validate(raw)


def test_normalize_workout_returns_json_ready_dict():
    normalized = normalize_workout(SAMPLE_WORKOUT)

    assert normalized["id"] == "05fcaa01-d0ec-4206-bd4e-a47585915642"
    assert normalized["title"] == "Afternoon workout 💪"
    assert normalized["routine_id"] is None
    assert datetime.fromisoformat(normalized["start_time"]) == datetime(
        2025, 11, 27, 13, 13, 23, tzinfo=UTC
    )
    assert datetime.fromisoformat(normalized["updated_at"]) == datetime(
        2025, 11, 27, 14, 6, 5, 703000, tzinfo=UTC
    )
    assert isinstance(normalized["exercises"], list)
    assert normalized["exercises"][0]["exercise_template_id"] == "55E6546F"
    assert normalized["exercises"][0]["sets"][0]["weight_kg"] == 40.0

    # The JSON-mode dump must re-validate to the same model unchanged.
    assert HevyWorkout.model_validate(normalized) == HevyWorkout.model_validate(
        SAMPLE_WORKOUT
    )
