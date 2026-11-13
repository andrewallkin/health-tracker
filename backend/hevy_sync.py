"""Sync service for Hevy data: templates, workouts, events, Garmin linking.

All functions are module-level and take the ``db`` session first plus an
injected ``client`` (a ``HevyClient``; tests pass a fake with the same
methods — no network). Public functions commit before returning so callers
(e.g. the load endpoints and the webhook worker) get persisted state; every
upserted workout (single sync, events feed, backfill) is Garmin-linked 1:1
and committed as it lands. Saving a Garmin day runs the same match against
Hevy workouts already stored for that date, so a workout that landed before
the watch sync still gets linked. An activity with no Hevy start inside the
window stays unmatched.

Day attribution is locked to ``Africa/Johannesburg`` (SAST): a workout's
``local_date`` is the SAST calendar day of its UTC ``start_time``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Callable, Iterator
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from backend.db_models import (
    GarminDailyHealthRow,
    HevyExerciseTemplateRow,
    HevySyncStateRow,
    HevyWorkoutRow,
)
from backend.hevy_client import HevyClient
from backend.hevy_schemas import HevyExerciseTemplate, normalize_workout

TZ = ZoneInfo("Africa/Johannesburg")

PAGE_SIZE = 10  # Hevy's pageSize cap (enforced again by HevyClient).
_RECONCILE_WINDOW = timedelta(minutes=20)
_EVENT_TS_KEYS = ("updated_at", "deleted_at")


def _paginate(
    fetch: Callable[[int], dict[str, Any]], key: str
) -> Iterator[list[dict[str, Any]]]:
    """Yield item lists page by page until ``page_count`` is exhausted."""
    page = 1
    while True:
        payload = fetch(page) or {}
        items = payload.get(key) or []
        yield items
        page_count = int(payload.get("page_count") or 1)
        if page >= page_count:
            return
        page += 1


def _assume_utc(value: datetime) -> datetime:
    """Treat a naive datetime as UTC (Hevy timestamps are UTC)."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _to_utc_naive(value: datetime) -> datetime:
    """Normalize a datetime to naive UTC for plain ``DateTime`` columns."""
    return _assume_utc(value).astimezone(UTC).replace(tzinfo=None)


def _local_date(start_time: datetime) -> str:
    """SAST calendar day of a Hevy start_time (the locked attribution rule)."""
    return _assume_utc(start_time).astimezone(TZ).date().isoformat()


def _get_or_create_sync_state(db: Session, user_id: str) -> HevySyncStateRow:
    state = (
        db.query(HevySyncStateRow).filter(HevySyncStateRow.user_id == user_id).one_or_none()
    )
    if state is None:
        state = HevySyncStateRow(id=str(uuid.uuid4()), user_id=user_id)
        db.add(state)
        db.flush()
    return state


def sync_exercise_templates(db: Session, client: HevyClient) -> int:
    """Upsert the full exercise template catalogue; returns templates synced."""
    count = 0
    for items in _paginate(
        lambda page: client.get_exercise_templates(page=page, page_size=PAGE_SIZE),
        "exercise_templates",
    ):
        for raw in items:
            template = HevyExerciseTemplate.model_validate(raw)
            row = db.get(HevyExerciseTemplateRow, template.id)
            if row is None:
                row = HevyExerciseTemplateRow(id=template.id)
                db.add(row)
            row.title = template.title
            row.type = template.type
            row.primary_muscle_group = template.primary_muscle_group
            row.secondary_muscle_groups = template.secondary_muscle_groups
            row.equipment = template.equipment
            row.is_custom = template.is_custom
            row.thumbnail_url = template.thumbnail_url
            count += 1
    db.commit()
    return count


def _upsert_workout(db: Session, user_id: str, raw: dict[str, Any]) -> HevyWorkoutRow:
    """Validate, upsert one workout, and reconcile Garmin links.

    ``reconcile_links`` (which also commits the row) never overwrites an
    existing non-empty ``garmin_activity_ids`` list, so re-syncs are safe.
    """
    normalized = normalize_workout(raw)
    start_time = _assume_utc(datetime.fromisoformat(normalized["start_time"]))
    end_time = _assume_utc(datetime.fromisoformat(normalized["end_time"]))
    row = db.get(HevyWorkoutRow, normalized["id"])
    if row is None:
        row = HevyWorkoutRow(
            id=normalized["id"],
            user_id=user_id,
            title=normalized["title"],
            start_time=start_time,
            end_time=end_time,
            routine_id=normalized.get("routine_id"),
            local_date=_local_date(start_time),
            payload=normalized,
        )
        db.add(row)
    else:
        row.title = normalized["title"]
        row.start_time = start_time
        row.end_time = end_time
        row.routine_id = normalized.get("routine_id")
        row.local_date = _local_date(start_time)
        row.payload = normalized
    reconcile_links(db, row)
    return row


def sync_workout(
    db: Session, user_id: str, client: HevyClient, workout_id: str
) -> HevyWorkoutRow | None:
    """Fetch a single workout, upsert it idempotently, and link Garmin."""
    raw = client.get_workout(workout_id)
    if not raw:
        return None
    return _upsert_workout(db, user_id, raw)


def _activity_instant(garmin_row: GarminDailyHealthRow, activity: dict[str, Any]) -> datetime | None:
    """UTC start of a stored Garmin activity.

    ``startTimeUtc`` is the device's absolute start (Garmin ``startTimeGMT``).
    Snapshots taken before that field existed only have ``startTime``, a
    device-local ``HH:MM`` that older syncs stored as if it were SAST.
    """
    utc_raw = activity.get("startTimeUtc")
    if isinstance(utc_raw, str) and utc_raw.strip():
        try:
            return _assume_utc(datetime.fromisoformat(utc_raw.replace("Z", "+00:00")))
        except ValueError:
            pass
    start_time_raw = activity.get("startTime")
    if not isinstance(start_time_raw, str) or not start_time_raw.strip():
        return None
    try:
        return datetime.strptime(
            f"{garmin_row.date} {start_time_raw}", "%Y-%m-%d %H:%M"
        ).replace(tzinfo=TZ)
    except ValueError:
        return None


def _linked_activity_ids(
    db: Session, user_id: str, *, exclude_workout_id: str | None = None
) -> set[str]:
    """Activity ids already claimed by this user's other Hevy workouts."""
    rows = db.query(HevyWorkoutRow).filter(HevyWorkoutRow.user_id == user_id).all()
    taken: set[str] = set()
    for row in rows:
        if exclude_workout_id is not None and row.id == exclude_workout_id:
            continue
        taken.update(str(activity_id) for activity_id in (row.garmin_activity_ids or []))
    return taken


def _best_unlinked_activity(
    db: Session, workout_row: HevyWorkoutRow
) -> tuple[str, timedelta] | None:
    """Closest stored Garmin activity within 20 minutes that no workout holds.

    Prefer ``startTimeUtc`` so a watch set outside South Africa still matches;
    fall back to reading ``startTime`` as SAST when the snapshot has no UTC
    instant. Ties keep the first activity in payload order.
    """
    workout_start = _assume_utc(workout_row.start_time)
    taken = _linked_activity_ids(db, workout_row.user_id, exclude_workout_id=workout_row.id)
    garmin_rows = (
        db.query(GarminDailyHealthRow)
        .filter(
            GarminDailyHealthRow.user_id == workout_row.user_id,
            GarminDailyHealthRow.date == workout_row.local_date,
        )
        .all()
    )
    best_id: str | None = None
    best_delta: timedelta | None = None
    for garmin_row in garmin_rows:
        activities = (garmin_row.payload or {}).get("activities") or []
        for activity in activities:
            activity_id = activity.get("id")
            activity_start = _activity_instant(garmin_row, activity)
            if activity_start is None or not activity_id or str(activity_id) in taken:
                continue
            delta = abs(activity_start - workout_start)
            if delta <= _RECONCILE_WINDOW and (best_delta is None or delta < best_delta):
                best_id = str(activity_id)
                best_delta = delta
    if best_id is None or best_delta is None:
        return None
    return best_id, best_delta


def reconcile_links(db: Session, workout_row: HevyWorkoutRow) -> list[str]:
    """Link the workout to at most one Garmin activity (1:1, never overwrite).

    Candidates come from the ``GarminDailyHealthRow`` payload for the workout's
    ``local_date``. An activity matches when its start is within 20 minutes of
    the workout start and no other workout already holds it. The closest
    candidate wins. Commits before returning when the workout was unlinked.
    """
    current = list(workout_row.garmin_activity_ids or [])
    if current:
        return current

    match = _best_unlinked_activity(db, workout_row)
    if match is not None:
        workout_row.garmin_activity_ids = [match[0]]
    db.commit()
    return list(workout_row.garmin_activity_ids or [])


def reconcile_stored_activities(db: Session, user_id: str, local_date: str) -> None:
    """Link unlinked Hevy workouts on ``local_date`` to activities just stored.

    Called after a Garmin day is written. Each workout still takes at most one
    activity, closest start first, so a run or round of golf only links when
    some Hevy workout starts within 20 minutes. Existing links are left alone.
    """
    pending = [
        row
        for row in db.query(HevyWorkoutRow)
        .filter(HevyWorkoutRow.user_id == user_id, HevyWorkoutRow.local_date == local_date)
        .all()
        if not row.garmin_activity_ids
    ]
    while pending:
        ranked: list[tuple[timedelta, HevyWorkoutRow]] = []
        for workout in pending:
            match = _best_unlinked_activity(db, workout)
            if match is not None:
                ranked.append((match[1], workout))
        if not ranked:
            return
        ranked.sort(key=lambda item: item[0])
        winner = ranked[0][1]
        reconcile_links(db, winner)
        pending = [row for row in pending if row.id != winner.id]


def _event_timestamp(event: dict[str, Any]) -> datetime | None:
    """``updated_at``/``deleted_at`` of an event, parsed and UTC-normalized."""
    for key in _EVENT_TS_KEYS:
        raw = event.get(key)
        if raw:
            parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            return _assume_utc(parsed)
    return None


def sync_workout_events(
    db: Session, user_id: str, client: HevyClient, since: datetime | None
) -> int:
    """Apply workout update/delete events; returns events applied.

    Events at or before ``since`` are skipped. Applied chronologically, the
    sync state's ``last_event_processed_at`` tracks the newest event handled.
    """
    events: list[tuple[datetime | None, dict[str, Any]]] = []
    for items in _paginate(
        lambda page: client.get_workout_events(page=page, page_size=PAGE_SIZE),
        "workout_events",
    ):
        for event in items:
            events.append((_event_timestamp(event), event))
    # Apply in chronological order so a delete is never clobbered by an older
    # update arriving on a later (newest-first) page.
    events.sort(
        key=lambda pair: (pair[0] is None, pair[0] or datetime.min.replace(tzinfo=UTC))
    )

    since_utc = _assume_utc(since) if since is not None else None
    applied = 0
    handled_at: list[datetime] = []
    for event_time, event in events:
        if since_utc is not None and event_time is not None and event_time <= since_utc:
            continue
        workout_id = event.get("workout_id")
        if not workout_id:
            continue
        if event.get("type") == "delete":
            row = db.get(HevyWorkoutRow, workout_id)
            if row is not None and row.user_id == user_id:
                db.delete(row)
                # Flush now so a newer update event later in this run re-creates
                # the row instead of mutating the pending-deleted instance
                # (identity map still holds it until the DELETE is flushed).
                db.flush()
                applied += 1
        else:
            raw = client.get_workout(workout_id)
            if raw:
                _upsert_workout(db, user_id, raw)
                applied += 1
        if event_time is not None:
            handled_at.append(event_time)

    state = _get_or_create_sync_state(db, user_id)
    if handled_at:
        state.last_event_processed_at = _to_utc_naive(max(handled_at))
    elif since_utc is not None:
        state.last_event_processed_at = _to_utc_naive(since_utc)
    else:
        state.last_event_processed_at = datetime.utcnow()
    db.commit()
    return applied


def backfill_workouts(db: Session, user_id: str, client: HevyClient) -> int:
    """Upsert + Garmin-link every workout from the paginated feed; returns count."""
    count = 0
    for items in _paginate(
        lambda page: client.get_workouts(page=page, page_size=PAGE_SIZE), "workouts"
    ):
        for raw in items:
            _upsert_workout(db, user_id, raw)
            count += 1
    db.commit()
    return count
