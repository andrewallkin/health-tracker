from __future__ import annotations

import threading
import time as time_module
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from ..database import SessionLocal
from ..db_models import AppSettingsRow, GarminMetricSnapshotRow
from .external_service import create_health_snapshot

TZ = ZoneInfo("Africa/Johannesburg")
CAPTURE_WEEKDAY = 0        # Monday
CAPTURE_HOUR = 7
_BACKOFF_SECONDS = 4 * 3600
_MAX_SLEEP_SECONDS = 3600
_STARTED = threading.Event()


def _aware_utc(value: datetime) -> datetime:
    """fetched_at is stored naive-UTC; attach UTC if tzinfo is missing."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def last_capture_due(now: datetime) -> datetime:
    """Most recent Monday 07:00 SAST at or before `now`."""
    target = now.replace(hour=CAPTURE_HOUR, minute=0, second=0, microsecond=0)
    days_back = (now.weekday() - CAPTURE_WEEKDAY) % 7
    target -= timedelta(days=days_back)
    if target > now:  # this week's Monday 07:00 hasn't happened yet
        target -= timedelta(days=7)
    return target


def seconds_until_next_capture(now: datetime) -> float:
    target = now.replace(hour=CAPTURE_HOUR, minute=0, second=0, microsecond=0)
    days_ahead = (CAPTURE_WEEKDAY - now.weekday()) % 7
    if days_ahead == 0 and target <= now:
        days_ahead = 7
    target += timedelta(days=days_ahead)
    return (target - now).total_seconds()


def needs_capture(last_fetched_at: datetime | None, now: datetime) -> bool:
    """Capture when now is past this week's Monday 07:00 and there is
    no snapshot taken since that moment."""
    due = _aware_utc(last_capture_due(now))
    if last_fetched_at is None:
        return True
    return _aware_utc(last_fetched_at) < due


def _connected_settings_rows(db) -> list[AppSettingsRow]:
    return [row for row in db.query(AppSettingsRow).all()
            if row.garmin_email and row.garmin_tokens_encrypted]


def _run_loop() -> None:
    consecutive_failures = 0
    while True:
        cycle_failed = False
        try:
            now = datetime.now(TZ)
            db = SessionLocal()
            try:
                for row in _connected_settings_rows(db):
                    latest = (
                        db.query(GarminMetricSnapshotRow)
                        .filter_by(user_id=row.user_id)
                        .order_by(GarminMetricSnapshotRow.fetched_at.desc())
                        .first()
                    )
                    if not needs_capture(latest.fetched_at if latest else None, now):
                        continue
                    try:
                        create_health_snapshot(db, row.user_id)
                    except Exception:  # noqa: BLE001 — one user failing must not stop the rest
                        cycle_failed = True
                        db.rollback()
            finally:
                db.close()
            consecutive_failures = 0
        except Exception:  # noqa: BLE001 — scheduler must never crash the process
            cycle_failed = True
        if cycle_failed:
            consecutive_failures += 1
        else:
            consecutive_failures = 0
        # Normal cadence: wake hourly (cheap no-op checks, catches newly connected
        # users mid-week). After failed capture cycles: back off to 4-hour retries.
        cap = _BACKOFF_SECONDS if consecutive_failures else _MAX_SLEEP_SECONDS
        time_module.sleep(min(seconds_until_next_capture(datetime.now(TZ)), cap))


def start_snapshot_scheduler() -> None:
    if _STARTED.is_set():
        return
    _STARTED.set()
    thread = threading.Thread(target=_run_loop, name="garmin-snapshot-scheduler", daemon=True)
    thread.start()