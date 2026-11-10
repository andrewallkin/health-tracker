"""Query and write functions for the Hevy external endpoints.

Reads are served from the local mirror (``hevy_workouts`` /
``hevy_exercise_templates``) — no Hevy API calls at read time. Time logic
uses the row columns (``start_time``, ``local_date``); exercise and set
detail comes from the normalized JSON payload stored by the sync layer.
Progression and PR math include every logged set (warmups included).

Write proxies forward validated agent payloads to the Hevy API (routine
bodies only lose ``rep_range`` keys left unset — Hevy rejects an explicit
``"rep_range": null`` on PUT) and surface Hevy and network errors as 502
responses. The body-measurement proxy reads the date first: a missing
measurement is created with POST (201) and an existing one is overwritten
with PUT (200).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import requests
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db_models import GarminDailyHealthRow, HevyExerciseTemplateRow, HevySyncStateRow, HevyWorkoutRow, UserRow
from ..hevy_client import HevyAPIError, HevyClient
from ..hevy_sync import PAGE_SIZE, _paginate, backfill_workouts, sync_exercise_templates, sync_workout_events
from .schemas_external import HevyRoutineCreate, HevyRoutineFolderCreate, HevyRoutineUpdate

# Muscle groups observed in the Hevy exercise-template catalogue.
MUSCLE_GROUPS: list[str] = [
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
EQUIPMENT: list[str] = [
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
EXERCISE_TYPES: list[str] = [
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
SET_TYPES: list[str] = ["warmup", "normal", "failure", "dropset"]
ID_FORMATS_NOTE = (
    "Workout and routine ids are 36-character UUID strings; routine-folder ids "
    "are plain integers; exercise template ids are 8-character uppercase hex "
    "strings (e.g. '55E6546F') for catalogue exercises and 36-character UUID "
    "strings for custom exercises."
)

# Exercise types whose sets carry duration/distance instead of weight × reps.
_DURATION_TYPES = {"duration", "distance_duration", "floors_duration", "steps_duration"}
# Types that also report distance; their PR metric is max distance.
_DISTANCE_TYPES = {"distance_duration"}


def _round2(value: float) -> float:
    return round(float(value), 2)


def _assume_utc(value: datetime) -> datetime:
    """SQLite returns naive UTC datetimes; treat those as UTC like hevy_sync does."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return _assume_utc(value).isoformat()


def _payload(row: HevyWorkoutRow) -> dict:
    return row.payload if isinstance(row.payload, dict) else {}


def _exercises_of(payload: dict) -> list[dict]:
    exercises = payload.get("exercises")
    if not isinstance(exercises, list):
        return []
    return [exercise for exercise in exercises if isinstance(exercise, dict)]


def _sets_of(exercise: dict) -> list[dict]:
    sets = exercise.get("sets")
    if not isinstance(sets, list):
        return []
    return [item for item in sets if isinstance(item, dict)]


def _start_end_strings(row: HevyWorkoutRow) -> tuple[str, str]:
    payload = _payload(row)
    start = payload.get("start_time")
    end = payload.get("end_time")
    start_str = start if isinstance(start, str) and start else None
    end_str = end if isinstance(end, str) and end else None
    return (
        start_str or _iso(row.start_time) or "",
        end_str or _iso(row.end_time) or "",
    )


def _workout_summary(row: HevyWorkoutRow) -> dict:
    exercises = _exercises_of(_payload(row))
    start_str, end_str = _start_end_strings(row)
    return {
        "id": row.id,
        "title": row.title,
        "start_time": start_str,
        "end_time": end_str,
        "local_date": row.local_date,
        "routine_id": row.routine_id,
        "garmin_activity_ids": list(row.garmin_activity_ids or []),
        "exercise_count": len(exercises),
        "set_count": sum(len(_sets_of(exercise)) for exercise in exercises),
    }


def _workouts_in_range(
    db: Session, user_id: str, from_key: str | None, to_key: str | None
):
    query = db.query(HevyWorkoutRow).filter(HevyWorkoutRow.user_id == user_id)
    if from_key:
        query = query.filter(HevyWorkoutRow.local_date >= from_key)
    if to_key:
        query = query.filter(HevyWorkoutRow.local_date <= to_key)
    return query


def list_hevy_workouts(
    db: Session,
    user_id: str,
    from_key: str | None = None,
    to_key: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Workout summaries for the user, newest first, filtered on local_date."""
    rows = (
        _workouts_in_range(db, user_id, from_key, to_key)
        .order_by(HevyWorkoutRow.start_time.desc())
        .limit(limit)
        .all()
    )
    return [_workout_summary(row) for row in rows]


def get_hevy_workout(db: Session, user_id: str, workout_id: str) -> dict | None:
    """Full workout detail (exercises + sets) or None when not owned by the user."""
    row = (
        db.query(HevyWorkoutRow)
        .filter(HevyWorkoutRow.user_id == user_id, HevyWorkoutRow.id == workout_id)
        .first()
    )
    if row is None:
        return None
    detail = _workout_summary(row)
    payload = _payload(row)
    description = payload.get("description")
    detail["description"] = (
        None if isinstance(description, str) and not description.strip() else description
    )
    detail["exercises"] = _exercises_of(payload)
    return detail


def _template_out(row: HevyExerciseTemplateRow) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "type": row.type,
        "primary_muscle_group": row.primary_muscle_group,
        "secondary_muscle_groups": list(row.secondary_muscle_groups or []),
        "equipment": row.equipment,
        "is_custom": bool(row.is_custom),
        "thumbnail_url": row.thumbnail_url,
    }


def list_hevy_exercises(
    db: Session,
    muscle_group: str | None = None,
    equipment: str | None = None,
    type_: str | None = None,
    search: str | None = None,
) -> list[dict]:
    """Exercise-template catalogue entries, all case-insensitive filters, by title."""
    query = db.query(HevyExerciseTemplateRow)
    if muscle_group and muscle_group.strip():
        query = query.filter(
            func.lower(HevyExerciseTemplateRow.primary_muscle_group)
            == muscle_group.strip().lower()
        )
    if equipment and equipment.strip():
        query = query.filter(
            func.lower(HevyExerciseTemplateRow.equipment) == equipment.strip().lower()
        )
    if type_ and type_.strip():
        query = query.filter(
            func.lower(HevyExerciseTemplateRow.type) == type_.strip().lower()
        )
    if search and search.strip():
        query = query.filter(
            func.lower(HevyExerciseTemplateRow.title).like(f"%{search.strip().lower()}%")
        )
    rows = query.order_by(HevyExerciseTemplateRow.title).all()
    return [_template_out(row) for row in rows]


def hevy_metadata() -> dict:
    """Static catalogue values an agent needs to build filters and payloads."""
    return {
        "muscle_groups": list(MUSCLE_GROUPS),
        "equipment": list(EQUIPMENT),
        "exercise_types": list(EXERCISE_TYPES),
        "set_types": list(SET_TYPES),
        "id_formats": ID_FORMATS_NOTE,
    }


def _classify(template: HevyExerciseTemplateRow | None, sets: list[dict]) -> str:
    """Return 'weight' | 'duration' | 'distance' for progression/PR math."""
    if template is not None:
        if template.type in _DISTANCE_TYPES:
            return "distance"
        if template.type in _DURATION_TYPES:
            return "duration"
        return "weight"
    # Template missing from the catalogue: infer from the logged sets.
    if any(s.get("distance_meters") is not None for s in sets):
        return "distance"
    if any(s.get("duration_seconds") is not None for s in sets):
        return "duration"
    return "weight"


def _sets_for_template(row: HevyWorkoutRow, template_id: str) -> list[dict]:
    sets: list[dict] = []
    for exercise in _exercises_of(_payload(row)):
        if exercise.get("exercise_template_id") == template_id:
            sets.extend(_sets_of(exercise))
    return sets


def _weighted_values(sets: list[dict]) -> tuple[list[float], list[float]]:
    """Return (e1RM values, weight candidates) for sets that carry a weight."""
    e1rms: list[float] = []
    weights: list[float] = []
    for s in sets:
        weight = s.get("weight_kg")
        if weight is None:
            continue
        weights.append(weight)
        reps = s.get("reps")
        if reps is not None:
            e1rms.append(weight * (1 + reps / 30))
    return e1rms, weights


def _total_volume(sets: list[dict]) -> float:
    return _round2(
        sum(
            s["weight_kg"] * s["reps"]
            for s in sets
            if s.get("weight_kg") is not None and s.get("reps") is not None
        )
    )


def _metric_values(sets: list[dict], key: str) -> list:
    return [s[key] for s in sets if s.get(key) is not None]


def exercise_progression(
    db: Session,
    user_id: str,
    template_id: str,
    from_key: str | None = None,
    to_key: str | None = None,
) -> list[dict] | None:
    """Per-session stats for one exercise, oldest first.

    Weight sessions carry ``best_e1rm`` / ``top_weight`` / ``total_volume_kg``;
    duration and distance sessions carry ``best_duration_seconds`` /
    ``best_distance_meters`` instead. Returns None when the template itself is
    unknown (the route turns that into a 404).
    """
    template = db.get(HevyExerciseTemplateRow, template_id)
    if template is None:
        return None
    rows = (
        _workouts_in_range(db, user_id, from_key, to_key)
        .order_by(HevyWorkoutRow.start_time.asc(), HevyWorkoutRow.id.asc())
        .all()
    )
    entries: list[dict] = []
    for row in rows:
        sets = _sets_for_template(row, template_id)
        if not sets:
            continue
        entry: dict = {"date": row.local_date, "workout_id": row.id, "n_sets": len(sets)}
        kind = _classify(template, sets)
        if kind == "weight":
            e1rms, weights = _weighted_values(sets)
            entry["best_e1rm"] = _round2(max(e1rms)) if e1rms else None
            entry["top_weight"] = _round2(max(weights)) if weights else None
            entry["total_volume_kg"] = _total_volume(sets)
        else:
            durations = _metric_values(sets, "duration_seconds")
            distances = _metric_values(sets, "distance_meters")
            entry["best_duration_seconds"] = max(durations) if durations else None
            if kind == "distance":
                entry["best_distance_meters"] = max(distances) if distances else None
        entries.append(entry)
    return entries


def _template_map(
    db: Session, template_ids: list[str]
) -> dict[str, HevyExerciseTemplateRow]:
    if not template_ids:
        return {}
    rows = (
        db.query(HevyExerciseTemplateRow)
        .filter(HevyExerciseTemplateRow.id.in_(template_ids))
        .all()
    )
    return {row.id: row for row in rows}


def _pr_records(
    sessions: list[tuple[HevyWorkoutRow, list[dict]]],
    template: HevyExerciseTemplateRow | None,
) -> tuple[dict | None, dict | None]:
    """Reduce chronological sessions of one template to (pr, best_e1rm).

    ``pr`` is the first session that reached the maximum (weight for weight
    exercises, duration/distance for cardio types, reps when no weight was
    logged). ``best_e1rm`` is tracked separately for weight exercises because
    its peak may land on a different date than the top weight.
    """
    all_sets = [s for _, sets in sessions for s in sets]
    kind = _classify(template, all_sets)
    pr: dict | None = None
    best_e1rm: dict | None = None
    if kind == "weight":
        reps_pr: dict | None = None
        for row, sets in sessions:
            e1rms, weights = _weighted_values(sets)
            if weights:
                top = _round2(max(weights))
                if pr is None or top > pr["value"]:
                    pr = {"metric": "weight_kg", "value": top, "date": row.local_date}
            if e1rms:
                best = _round2(max(e1rms))
                if best_e1rm is None or best > best_e1rm["value"]:
                    best_e1rm = {"value": best, "date": row.local_date}
            session_reps = [s["reps"] for s in sets if s.get("reps") is not None]
            if session_reps:
                top_reps = max(session_reps)
                if reps_pr is None or top_reps > reps_pr["value"]:
                    reps_pr = {"metric": "reps", "value": top_reps, "date": row.local_date}
        if pr is None:
            pr = reps_pr
    else:
        key = "duration_seconds" if kind == "duration" else "distance_meters"
        overall = max(
            (value for _, sets in sessions for value in _metric_values(sets, key)),
            default=None,
        )
        if overall is not None:
            for row, sets in sessions:
                values = _metric_values(sets, key)
                if values and max(values) == overall:
                    pr = {"metric": key, "value": overall, "date": row.local_date}
                    break
    return pr, best_e1rm


def exercise_prs(db: Session, user_id: str) -> list[dict]:
    """One PR record per template ever done, sorted by title."""
    rows = (
        db.query(HevyWorkoutRow)
        .filter(HevyWorkoutRow.user_id == user_id)
        .order_by(HevyWorkoutRow.start_time.asc(), HevyWorkoutRow.id.asc())
        .all()
    )
    sessions: dict[str, list[tuple[HevyWorkoutRow, list[dict]]]] = {}
    entry_titles: dict[str, str] = {}
    history: dict[str, int] = {}
    for row in rows:
        seen: set[str] = set()
        grouped: dict[str, list[dict]] = {}
        for exercise in _exercises_of(_payload(row)):
            template_id = exercise.get("exercise_template_id")
            if not isinstance(template_id, str) or not template_id:
                continue
            seen.add(template_id)
            grouped.setdefault(template_id, []).extend(_sets_of(exercise))
            entry_titles.setdefault(template_id, exercise.get("title") or template_id)
        for template_id in seen:
            history[template_id] = history.get(template_id, 0) + 1
            sessions.setdefault(template_id, []).append((row, grouped.get(template_id, [])))

    template_map = _template_map(db, list(history))
    entries: list[dict] = []
    for template_id, count in history.items():
        template = template_map.get(template_id)
        pr, best_e1rm = _pr_records(sessions[template_id], template)
        if pr is None:
            continue
        title = template.title if template is not None else entry_titles.get(template_id, template_id)
        entry = {
            "template_id": template_id,
            "title": title,
            "pr": pr,
            "history_count": count,
        }
        if best_e1rm is not None:
            entry["best_e1rm"] = best_e1rm
        entries.append(entry)
    entries.sort(key=lambda entry: entry["title"])
    return entries


def exercise_habits(
    db: Session, user_id: str, from_key: str | None = None, to_key: str | None = None
) -> dict:
    """How often each exercise appears (sessions) and how equipment is used."""
    rows = (
        _workouts_in_range(db, user_id, from_key, to_key)
        .order_by(HevyWorkoutRow.start_time.asc(), HevyWorkoutRow.id.asc())
        .all()
    )
    counts: dict[str, int] = {}
    entry_titles: dict[str, str] = {}
    for row in rows:
        seen: set[str] = set()
        for exercise in _exercises_of(_payload(row)):
            template_id = exercise.get("exercise_template_id")
            if not isinstance(template_id, str) or not template_id:
                continue
            seen.add(template_id)
            entry_titles.setdefault(template_id, exercise.get("title") or template_id)
        for template_id in seen:
            counts[template_id] = counts.get(template_id, 0) + 1

    template_map = _template_map(db, list(counts))
    exercise_entries = [
        {
            "template_id": template_id,
            "title": (
                template_map[template_id].title
                if template_id in template_map
                else entry_titles.get(template_id, template_id)
            ),
            "count": count,
        }
        for template_id, count in counts.items()
    ]
    exercise_entries.sort(key=lambda entry: (-entry["count"], entry["title"]))

    equipment_counts: dict[str, int] = {}
    for entry in exercise_entries:
        template = template_map.get(entry["template_id"])
        if template is None:
            continue
        equipment_counts[template.equipment] = equipment_counts.get(template.equipment, 0) + entry["count"]
    equipment_entries = [
        {"equipment": name, "count": count} for name, count in equipment_counts.items()
    ]
    equipment_entries.sort(key=lambda entry: (-entry["count"], entry["equipment"]))
    return {"exercises": exercise_entries, "equipment_profile": equipment_entries}


# --- write proxies --------------------------------------------------------------


def _hevy_forward(call, *args: object) -> dict:
    """Invoke a Hevy client write call; surface Hevy and network errors as 502."""
    try:
        return call(*args)
    except (HevyAPIError, requests.RequestException) as err:
        raise HTTPException(status_code=502, detail=str(err)) from err


def _prune_null_rep_ranges(node: object) -> object:
    """Drop ``"rep_range"`` keys whose value is ``None`` at every nesting level.

    Hevy's ``PUT /v1/routines/{id}`` rejects an explicit ``"rep_range": null``
    with 400 ``Expected object, received null``. Every field of Hevy's routine
    PUT/POST schemas is optional, so omitting the key is safe everywhere.
    ``None`` scalars (``notes``, ``weight_kg``, …) are semantically meaningful
    and are forwarded unchanged.
    """
    if isinstance(node, dict):
        return {
            key: _prune_null_rep_ranges(value)
            for key, value in node.items()
            if not (key == "rep_range" and value is None)
        }
    if isinstance(node, list):
        return [_prune_null_rep_ranges(item) for item in node]
    return node


def list_routines_proxy(db: Session, user: UserRow, client: HevyClient) -> list[dict]:
    """Return the configured Hevy account's routines, following pagination.

    Unlike the mirror-backed reads, this calls Hevy live (page by page,
    Hevy's 10-per-page cap) and returns the ``routines`` entries as-is.
    Agents should list routines before creating or updating one: Hevy does
    not enforce title uniqueness, so updating an existing routine is usually
    preferable to creating a near-duplicate (intentional duplicates stay
    allowed).
    """
    return [
        routine
        for page in _paginate(
            lambda page_number: _hevy_forward(client.get_routines, page_number, PAGE_SIZE),
            "routines",
        )
        for routine in page
    ]


def create_routine_proxy(
    db: Session, user: UserRow, client: HevyClient, body: HevyRoutineCreate
) -> dict:
    """Forward a validated ``PostRoutinesRequestBody`` to Hevy and return its response."""
    return _hevy_forward(client.create_routine, _prune_null_rep_ranges(body.model_dump()))


def update_routine_proxy(
    db: Session,
    user: UserRow,
    client: HevyClient,
    routine_id: str,
    body: HevyRoutineUpdate,
) -> dict:
    """Forward a validated routine overwrite for ``routine_id`` to Hevy."""
    return _hevy_forward(
        client.update_routine, routine_id, _prune_null_rep_ranges(body.model_dump())
    )


def create_folder_proxy(
    db: Session, user: UserRow, client: HevyClient, body: HevyRoutineFolderCreate
) -> dict:
    """Forward a validated ``PostRoutineFolderRequestBody`` to Hevy."""
    return _hevy_forward(client.create_routine_folder, body.model_dump())


def get_body_measurement_proxy(
    db: Session, user: UserRow, client: HevyClient, date: str
) -> dict:
    """Return Hevy's body measurement for ``date``, or 404 when Hevy has none."""
    try:
        measurement = client.get_body_measurement(date)
    except (HevyAPIError, requests.RequestException) as err:
        raise HTTPException(status_code=502, detail=str(err)) from err
    if not measurement:
        raise HTTPException(status_code=404, detail="Body measurement not found")
    return measurement


def put_body_measurement_proxy(
    db: Session, user: UserRow, client: HevyClient, date: str, body: dict
) -> tuple[dict, bool]:
    """Upsert validated body-measurement fields for ``date`` on Hevy.

    Live Hevy's ``PUT /v1/body_measurements/{date}`` can answer 200 with an
    empty body even when the date is new, so a successful PUT cannot tell a
    create from an update. The proxy asks ``GET`` first. A missing date is
    created with ``POST /v1/body_measurements`` (the date lives in that body)
    and reported as created. An existing date is overwritten with PUT — fields
    omitted from ``body`` are cleared, matching Hevy's replace semantics.

    A 409 from the POST means another writer created the entry in between:
    the measurement is re-fetched, the validated fields are merged on top,
    and the PUT is retried. Returns ``(hevy_response, created)`` where
    ``created`` is True only when the POST succeeded — the route maps that
    to 201. Other Hevy or network failures surface as 502.
    """
    try:
        existing = client.get_body_measurement(date)
    except (HevyAPIError, requests.RequestException) as err:
        raise HTTPException(status_code=502, detail=str(err)) from err
    if existing:
        return _hevy_forward(client.put_body_measurement, date, body), False
    try:
        client.create_body_measurement({**body, "date": date})
    except (HevyAPIError, requests.RequestException) as err:
        if not (isinstance(err, HevyAPIError) and err.status == 409):
            raise HTTPException(status_code=502, detail=str(err)) from err
        try:
            raced = client.get_body_measurement(date) or {}
        except (HevyAPIError, requests.RequestException) as fetch_err:
            raise HTTPException(status_code=502, detail=str(fetch_err)) from fetch_err
        merged = {key: value for key, value in raced.items() if key != "date"}
        merged.update(body)
        return _hevy_forward(client.put_body_measurement, date, merged), False
    return {}, True


# --- user resolution (webhook worker + catch-up scheduler) -----------------------


def configured_hevy_user_id(db: Session) -> str | None:
    """The deployment's single Hevy-configured user, or ``None``.

    The Hevy API key is global env config (not per-user), so the Hevy mirror
    belongs to the deployment's first registered user; ``None`` when there is
    no user yet.
    """
    user = db.query(UserRow).order_by(UserRow.created_at.asc()).first()
    return user.id if user is not None else None


# --- manual Garmin link management ------------------------------------------------


def _activity_ids_for_date(db: Session, user_id: str, date_key: str) -> set[str]:
    """Garmin activity ids stored for the user on ``date_key``."""
    rows = (
        db.query(GarminDailyHealthRow)
        .filter(
            GarminDailyHealthRow.user_id == user_id,
            GarminDailyHealthRow.date == date_key,
        )
        .all()
    )
    ids: set[str] = set()
    for row in rows:
        activities = (row.payload or {}).get("activities") or []
        for activity in activities:
            if isinstance(activity, dict) and activity.get("id"):
                ids.add(str(activity["id"]))
    return ids


def link_garmin_activity(
    db: Session, user_id: str, workout_id: str, garmin_activity_id: str
) -> dict:
    """Manually link a Garmin activity to the user's Hevy workout (1:1).

    404 when either side does not exist (the activity must be present in the
    workout's ``local_date`` Garmin payload); 409 when either side is already
    linked to a different partner. Commits and returns the workout's links.
    """
    workout = (
        db.query(HevyWorkoutRow)
        .filter(HevyWorkoutRow.user_id == user_id, HevyWorkoutRow.id == workout_id)
        .first()
    )
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    if workout.garmin_activity_ids:
        raise HTTPException(status_code=409, detail="Workout already linked to a Garmin activity")
    if garmin_activity_id not in _activity_ids_for_date(db, user_id, workout.local_date):
        raise HTTPException(status_code=404, detail="Garmin activity not found")
    others = db.query(HevyWorkoutRow).filter(HevyWorkoutRow.user_id == user_id).all()
    for other in others:
        if other.id != workout_id and garmin_activity_id in (other.garmin_activity_ids or []):
            raise HTTPException(
                status_code=409, detail="Garmin activity already linked to another workout"
            )
    workout.garmin_activity_ids = [garmin_activity_id]
    db.commit()
    return {"workout_id": workout.id, "garmin_activity_ids": list(workout.garmin_activity_ids)}


def unlink_garmin_activity(
    db: Session, user_id: str, workout_id: str, garmin_activity_id: str
) -> dict:
    """Remove ``garmin_activity_id`` from the workout's links when present."""
    workout = (
        db.query(HevyWorkoutRow)
        .filter(HevyWorkoutRow.user_id == user_id, HevyWorkoutRow.id == workout_id)
        .first()
    )
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    links = list(workout.garmin_activity_ids or [])
    if garmin_activity_id not in links:
        raise HTTPException(status_code=404, detail="Garmin activity not linked to this workout")
    remaining = [link for link in links if link != garmin_activity_id]
    workout.garmin_activity_ids = remaining
    db.commit()
    return {"workout_id": workout.id, "garmin_activity_ids": remaining}


# --- bulk load (idempotent sync triggers) ------------------------------------------


def _get_or_create_sync_state(db: Session, user_id: str) -> HevySyncStateRow:
    state = db.query(HevySyncStateRow).filter(HevySyncStateRow.user_id == user_id).one_or_none()
    if state is None:
        state = HevySyncStateRow(id=str(uuid.uuid4()), user_id=user_id)
        db.add(state)
        db.flush()
    return state


def load_templates(db: Session, user_id: str, client: HevyClient) -> int:
    """Sync the full exercise-template catalogue and stamp ``templates_synced_at``."""
    count = sync_exercise_templates(db, client)
    state = _get_or_create_sync_state(db, user_id)
    state.templates_synced_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return count


def load_workouts(db: Session, user_id: str, client: HevyClient) -> int:
    """Backfill every workout from the paginated feed."""
    return backfill_workouts(db, user_id, client)


def load_events(db: Session, user_id: str, client: HevyClient) -> int:
    """Apply workout events since the last processed one."""
    state = _get_or_create_sync_state(db, user_id)
    return sync_workout_events(db, user_id, client, state.last_event_processed_at)
