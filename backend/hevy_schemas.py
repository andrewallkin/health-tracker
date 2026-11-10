"""Pydantic schemas for the Hevy v1 API payloads.

Every model sets ``extra="ignore"``: Hevy adds fields over time and unknown
keys must never break a sync. ``normalize_workout`` is the entry point the
sync layer uses to turn a raw API dict into a validated, JSON-ready dict.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

SetType = Literal["warmup", "normal", "failure", "dropset"]


class HevySet(BaseModel):
    """A single set inside a workout or routine exercise.

    ``rep_range`` is only populated on routine sets (``{"start": 8, "end": 12}``).
    """

    model_config = ConfigDict(extra="ignore")

    index: int
    type: SetType = "normal"
    weight_kg: float | None = None
    reps: int | None = None
    distance_meters: int | None = None
    duration_seconds: int | None = None
    rpe: float | None = None
    custom_metric: float | None = None
    rep_range: dict | None = None


class HevyExercise(BaseModel):
    """An exercise entry inside a workout or routine."""

    model_config = ConfigDict(extra="ignore")

    index: int
    title: str
    exercise_template_id: str
    superset_id: int | None = None
    rest_seconds: int | None = None
    notes: str | None = None
    sets: list[HevySet] = Field(default_factory=list)


class HevyWorkout(BaseModel):
    """A completed workout as returned by ``GET /v1/workouts``."""

    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    routine_id: str | None = None
    description: str | None = None
    start_time: datetime
    end_time: datetime
    updated_at: datetime | None = None
    exercises: list[HevyExercise] = Field(default_factory=list)

    @classmethod
    def parse_hevy_datetime(cls, value: str) -> datetime:
        """Parse Hevy timestamps in either ``+00:00`` or trailing-``Z`` form."""
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    @field_validator("description", mode="before")
    @classmethod
    def _blank_description(cls, value: object) -> object:
        """Hevy sends ``""`` when a workout has no description; the API contract is null."""
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("start_time", "end_time", "updated_at", mode="before")
    @classmethod
    def _parse_timestamp(cls, value: object) -> object:
        if value is None or isinstance(value, datetime):
            return value
        return cls.parse_hevy_datetime(value)  # type: ignore[arg-type]


class HevyExerciseTemplate(BaseModel):
    """An entry of the exercise template catalogue (``GET /v1/exercise_templates``)."""

    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    type: str
    primary_muscle_group: str
    secondary_muscle_groups: list[str] = Field(default_factory=list)
    equipment: str
    is_custom: bool
    thumbnail_url: str | None = None


def normalize_workout(raw: dict) -> dict:
    """Validate a raw Hevy workout payload and return a JSON-ready dict."""
    return HevyWorkout.model_validate(raw).model_dump(mode="json")
