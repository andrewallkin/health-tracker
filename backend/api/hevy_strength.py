"""Day-strength block: aggregates a user's Hevy workouts for one local date.

Reads the normalized workout payloads stored by the sync layer
(``HevyWorkoutRow.payload``) and computes per-session training volume plus a
locked "hard set" rule, for embedding into the external day views
(``_health_block`` in ``external_service.py``).
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..db_models import HevyWorkoutRow
from .hevy_service import _exercises_of, _payload, _sets_of, _start_end_strings


def _volume_kg(exercises: list[dict]) -> float:
    """Sum of ``weight_kg * reps`` over non-warmup sets (cardio sets contribute 0)."""
    total = 0.0
    for exercise in exercises:
        for hevy_set in _sets_of(exercise):
            if hevy_set.get("type") == "warmup":
                continue
            weight_kg = hevy_set.get("weight_kg")
            reps = hevy_set.get("reps")
            if weight_kg is None or reps is None:
                continue
            total += float(weight_kg) * float(reps)
    return total


def count_hard_sets(exercises: list[dict]) -> int:
    """Count hard sets under the locked rule.

    A non-warmup set counts as hard if ``rpe >= 8``, or ``type == "failure"``,
    or it is a ``normal`` set with no rpe whose weight is that exercise's top
    non-warmup weight (ties all count). Warmup sets never count; a set carrying
    an explicit rpe below 8 is never hard via the top-set clause.
    """
    hard = 0
    for exercise in exercises:
        work_sets = [s for s in _sets_of(exercise) if s.get("type") != "warmup"]
        weights = [s.get("weight_kg") for s in work_sets if s.get("weight_kg") is not None]
        top_weight = max(weights) if weights else None
        for hevy_set in work_sets:
            rpe = hevy_set.get("rpe")
            if rpe is not None and rpe >= 8:
                hard += 1
            elif hevy_set.get("type") == "failure":
                hard += 1
            elif (
                hevy_set.get("type") == "normal"
                and rpe is None
                and hevy_set.get("weight_kg") is not None
                and hevy_set.get("weight_kg") == top_weight
            ):
                hard += 1
    return hard


def _session_out(row: HevyWorkoutRow) -> dict:
    exercises = _exercises_of(_payload(row))
    start_time, end_time = _start_end_strings(row)
    return {
        "workout_id": row.id,
        "title": row.title,
        "start_time": start_time,
        "end_time": end_time,
        "garmin_activity_ids": list(row.garmin_activity_ids or []),
        "total_volume_kg": round(_volume_kg(exercises), 2),
        "hard_sets": count_hard_sets(exercises),
        "n_exercises": len(exercises),
    }


def build_strength_block(db: Session, user_id: str, date_key: str) -> dict | None:
    """Strength summary for ``date_key``; ``None`` when the user trained nowhere."""
    rows = (
        db.query(HevyWorkoutRow)
        .filter(HevyWorkoutRow.user_id == user_id, HevyWorkoutRow.local_date == date_key)
        .order_by(HevyWorkoutRow.start_time.asc(), HevyWorkoutRow.id.asc())
        .all()
    )
    if not rows:
        return None
    sessions = [_session_out(row) for row in rows]
    return {
        "sessions": sessions,
        "total_volume_kg": round(sum(session["total_volume_kg"] for session in sessions), 2),
        "hard_sets": sum(session["hard_sets"] for session in sessions),
    }
