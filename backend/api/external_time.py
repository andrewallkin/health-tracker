from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException

EXTERNAL_TIMEZONE = "Africa/Johannesburg"
_ZONE = ZoneInfo(EXTERNAL_TIMEZONE)
_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def johannesburg_now(now: datetime | None = None) -> datetime:
    if now is None:
        return datetime.now(_ZONE)
    if now.tzinfo is None:
        return now.replace(tzinfo=_ZONE)
    return now.astimezone(_ZONE)


def today_key(now: datetime | None = None) -> str:
    return johannesburg_now(now).date().isoformat()


def current_hhmm(now: datetime | None = None) -> str:
    return johannesburg_now(now).strftime("%H:%M")


def parse_date_key(value: str, field: str = "date") -> date:
    if not _DATE_PATTERN.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    return date.fromisoformat(value)


def require_not_future(value: date, *, now: datetime | None = None) -> None:
    if value.isoformat() > today_key(now):
        raise HTTPException(status_code=400, detail="Date cannot be in the future")


def resolve_optional_date(value: str | None, *, now: datetime | None = None) -> str:
    if value is None:
        return today_key(now)
    parsed = parse_date_key(value)
    require_not_future(parsed, now=now)
    return parsed.isoformat()


def add_days(date_key: str, delta: int) -> str:
    return (date.fromisoformat(date_key) + timedelta(days=delta)).isoformat()


def monday_of(date_key: str) -> str:
    parsed = date.fromisoformat(date_key)
    return (parsed - timedelta(days=parsed.weekday())).isoformat()
