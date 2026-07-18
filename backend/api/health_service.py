from __future__ import annotations

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from backend.api.schemas import DailyHealth, HealthDayError
from backend.db_models import AppSettingsRow, GarminDailyHealthRow, utcnow


class GarminNotConnectedError(RuntimeError):
    pass


def require_garmin_connected(settings_row: AppSettingsRow) -> AppSettingsRow:
    if not settings_row.garmin_email or not settings_row.garmin_tokens_encrypted:
        raise GarminNotConnectedError("Garmin is not connected")
    return settings_row


def today_in_timezone(tz_name: str, now: datetime | None = None) -> str:
    timezone = ZoneInfo(tz_name)
    if now is None:
        local_now = datetime.now(timezone)
    elif now.tzinfo is None:
        local_now = now.replace(tzinfo=timezone)
    else:
        local_now = now.astimezone(timezone)
    return local_now.date().isoformat()


def _write_day(
    db: Session,
    user_id: str,
    date_str: str,
    payload: dict,
    today: str,
    row: GarminDailyHealthRow | None = None,
) -> DailyHealth:
    day = DailyHealth.model_validate(payload)
    persisted_payload = day.model_dump()
    is_complete = date_str < today
    if row is None:
        row = GarminDailyHealthRow(
            user_id=user_id,
            date=date_str,
            payload=persisted_payload,
            fetched_at=utcnow(),
            is_complete=is_complete,
        )
        db.add(row)
    else:
        row.payload = persisted_payload
        row.fetched_at = utcnow()
        row.is_complete = is_complete
    db.commit()
    return day


def resolve_day(
    db: Session,
    user_id: str,
    date_str: str,
    timezone: str,
    *,
    fetch_day: Callable[[str], dict],
    now: datetime | None = None,
) -> tuple[DailyHealth | None, list[HealthDayError]]:
    today = today_in_timezone(timezone, now)
    if date_str > today:
        return None, []

    row = (
        db.query(GarminDailyHealthRow)
        .filter_by(user_id=user_id, date=date_str)
        .one_or_none()
    )
    needs_fetch = date_str == today or row is None or not row.is_complete
    if not needs_fetch:
        return DailyHealth.model_validate(row.payload), []

    try:
        payload = fetch_day(date_str)
    except Exception as exc:
        error = HealthDayError(date=date_str, message=str(exc))
        if row is None:
            return None, [error]
        return DailyHealth.model_validate(row.payload), [error]

    day = _write_day(db, user_id, date_str, payload, today, row)
    return day, []


def resolve_dates(
    db: Session,
    user_id: str,
    dates: list[str],
    timezone: str,
    *,
    fetch_day: Callable[[str], dict],
    concurrency: int,
    now: datetime | None = None,
) -> tuple[list[DailyHealth], list[HealthDayError]]:
    today = today_in_timezone(timezone, now)
    eligible_dates = list(dict.fromkeys(date_str for date_str in dates if date_str <= today))
    rows = (
        db.query(GarminDailyHealthRow)
        .filter(
            GarminDailyHealthRow.user_id == user_id,
            GarminDailyHealthRow.date.in_(eligible_dates),
        )
        .all()
        if eligible_dates
        else []
    )
    rows_by_date = {row.date: row for row in rows}
    days_by_date: dict[str, DailyHealth] = {}
    need_fetch: list[str] = []

    for date_str in eligible_dates:
        row = rows_by_date.get(date_str)
        if date_str != today and row is not None and row.is_complete:
            days_by_date[date_str] = DailyHealth.model_validate(row.payload)
        else:
            need_fetch.append(date_str)

    fetch_results: dict[str, dict | Exception] = {}
    if need_fetch:
        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as executor:
            futures = {date_str: executor.submit(fetch_day, date_str) for date_str in need_fetch}
            for date_str, future in futures.items():
                try:
                    fetch_results[date_str] = future.result()
                except Exception as exc:
                    fetch_results[date_str] = exc

    errors_by_date: dict[str, HealthDayError] = {}
    for date_str in need_fetch:
        result = fetch_results[date_str]
        row = rows_by_date.get(date_str)
        if isinstance(result, Exception):
            errors_by_date[date_str] = HealthDayError(date=date_str, message=str(result))
            if row is not None:
                days_by_date[date_str] = DailyHealth.model_validate(row.payload)
            continue
        days_by_date[date_str] = _write_day(db, user_id, date_str, result, today, row)

    ordered_dates = [date_str for date_str in dates if date_str <= today]
    days = [days_by_date[date_str] for date_str in ordered_dates if date_str in days_by_date]
    errors = [errors_by_date[date_str] for date_str in ordered_dates if date_str in errors_by_date]
    return days, errors
