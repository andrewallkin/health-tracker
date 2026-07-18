from __future__ import annotations

import calendar
import re
import threading
from collections.abc import Callable
from datetime import date, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...config import get_settings
from ...crypto import decrypt_api_key, encrypt_api_key
from ...database import get_db
from ...db_models import AppSettingsRow, UserRow
from ...garmin_client import fetch_and_normalize_day, garmin_from_tokens
from ..deps import get_current_user
from ..health_service import (
    GarminNotConnectedError,
    require_garmin_connected,
    resolve_dates,
    resolve_day,
)
from ..mappers import get_or_create_app_settings
from ..schemas import HealthDayResponse, HealthDaysResponse


router = APIRouter(prefix="/health", tags=["health"])

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

GARMIN_NOT_CONNECTED_DETAIL = (
    "Garmin is not connected. Connect Garmin in Settings."
)


def _parse_date(value: str, field: str) -> date:
    if not DATE_PATTERN.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    return date.fromisoformat(value)


def _validate_timezone(timezone: str) -> None:
    try:
        ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid timezone") from exc


def _connected_settings(db: Session, user_id: str) -> AppSettingsRow:
    row = get_or_create_app_settings(db, user_id)
    try:
        return require_garmin_connected(row)
    except GarminNotConnectedError as exc:
        raise HTTPException(
            status_code=503,
            detail=GARMIN_NOT_CONNECTED_DETAIL,
        ) from exc


def build_fetch_day(
    settings_row: AppSettingsRow,
) -> tuple[Callable[[str], dict], Callable[[Session, AppSettingsRow], None]]:
    tokens_json = decrypt_api_key(settings_row.garmin_tokens_encrypted or "")
    garmin_lock = threading.Lock()

    def fetch_day(date_str: str) -> dict:
        nonlocal tokens_json
        with garmin_lock:
            snapshot = tokens_json
        api = garmin_from_tokens(snapshot)
        payload = fetch_and_normalize_day(api, date_str)
        refreshed_tokens = api.client.dumps()
        if refreshed_tokens != snapshot:
            with garmin_lock:
                if refreshed_tokens != tokens_json:
                    tokens_json = refreshed_tokens
        return payload

    def persist_tokens(db: Session, row: AppSettingsRow) -> None:
        with garmin_lock:
            encrypted = encrypt_api_key(tokens_json)
            if row.garmin_tokens_encrypted != encrypted:
                row.garmin_tokens_encrypted = encrypted
                db.commit()

    return fetch_day, persist_tokens


@router.get("/day", response_model=HealthDayResponse)
def get_health_day(
    date: str,
    timezone: str,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> HealthDayResponse:
    parsed_date = _parse_date(date, "date")
    _validate_timezone(timezone)
    settings_row = _connected_settings(db, user.id)
    fetch_day, persist_tokens = build_fetch_day(settings_row)
    day, errors = resolve_day(
        db,
        user.id,
        parsed_date.isoformat(),
        timezone,
        fetch_day=fetch_day,
    )
    persist_tokens(db, settings_row)
    return HealthDayResponse(day=day, errors=errors)


@router.get("/week", response_model=HealthDaysResponse)
def get_health_week(
    start: str,
    timezone: str,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> HealthDaysResponse:
    start_date = _parse_date(start, "start")
    _validate_timezone(timezone)
    settings_row = _connected_settings(db, user.id)
    fetch_day, persist_tokens = build_fetch_day(settings_row)
    dates = [
        (start_date + timedelta(days=offset)).isoformat()
        for offset in range(7)
    ]
    days, errors = resolve_dates(
        db,
        user.id,
        dates,
        timezone,
        fetch_day=fetch_day,
        concurrency=get_settings().garmin_fetch_concurrency,
    )
    persist_tokens(db, settings_row)
    return HealthDaysResponse(days=days, errors=errors)


@router.get("/month", response_model=HealthDaysResponse)
def get_health_month(
    year: int,
    month: int,
    timezone: str,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> HealthDaysResponse:
    _validate_timezone(timezone)
    if not 1 <= year <= 9999:
        raise HTTPException(status_code=400, detail="Invalid year")
    try:
        day_count = calendar.monthrange(year, month)[1]
    except (calendar.IllegalMonthError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid month") from exc

    settings_row = _connected_settings(db, user.id)
    fetch_day, persist_tokens = build_fetch_day(settings_row)
    dates = [
        date(year, month, day_number).isoformat()
        for day_number in range(1, day_count + 1)
    ]
    days, errors = resolve_dates(
        db,
        user.id,
        dates,
        timezone,
        fetch_day=fetch_day,
        concurrency=get_settings().garmin_fetch_concurrency,
    )
    persist_tokens(db, settings_row)
    return HealthDaysResponse(days=days, errors=errors)
