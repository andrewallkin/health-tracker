from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.api.health_service import (
    GarminNotConnectedError,
    require_garmin_connected,
    resolve_day,
    resolve_dates,
    today_in_timezone,
)
from backend.database import Base
from backend.db_models import GarminDailyHealthRow


NOW = datetime(2026, 7, 18, 15, 0, tzinfo=ZoneInfo("Africa/Johannesburg"))
TIMEZONE = "Africa/Johannesburg"
USER_ID = "health-service-user"


@pytest.fixture()
def db() -> Session:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine)
    session = testing_session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def health_payload(date_str: str, *, steps: int = 1_000) -> dict:
    return {
        "date": date_str,
        "steps": steps,
        "stepGoal": 8_000,
        "totalCalories": 2_100,
        "activeCalories": 400,
        "bmrCalories": 1_700,
        "restingHr": 55,
        "minHr": 48,
        "maxHr": 145,
        "avgRestingHr7d": 56,
        "sleepHours": 7.5,
        "deepSleepHours": 1.5,
        "remSleepHours": 1.75,
        "lightSleepHours": 4.25,
        "sleepAvgHr": 53,
        "sleepScore": 82,
        "hrv": 61,
        "hrvStatus": "balanced",
        "hrvWeeklyAvg": 59,
        "activities": [],
    }


def seed_day(
    db: Session,
    date_str: str,
    *,
    steps: int = 1_000,
    is_complete: bool,
) -> GarminDailyHealthRow:
    row = GarminDailyHealthRow(
        user_id=USER_ID,
        date=date_str,
        payload=health_payload(date_str, steps=steps),
        is_complete=is_complete,
    )
    db.add(row)
    db.commit()
    return row


def test_today_in_timezone_uses_iana_timezone() -> None:
    utc_now = datetime(2026, 7, 18, 23, 30, tzinfo=timezone.utc)

    assert today_in_timezone("Africa/Johannesburg", utc_now) == "2026-07-19"


def test_require_garmin_connected_rejects_missing_connection() -> None:
    settings = SimpleNamespace(
        garmin_email="garmin@example.com",
        garmin_tokens_encrypted=None,
    )

    with pytest.raises(GarminNotConnectedError, match="Garmin is not connected"):
        require_garmin_connected(settings)


def test_require_garmin_connected_returns_connected_settings() -> None:
    settings = SimpleNamespace(
        garmin_email="garmin@example.com",
        garmin_tokens_encrypted="encrypted tokens",
    )

    assert require_garmin_connected(settings) is settings


def test_today_always_fetches_and_marks_incomplete(db: Session) -> None:
    seed_day(db, "2026-07-18", steps=100, is_complete=False)
    calls: list[str] = []

    def fetch_day(date_str: str) -> dict:
        calls.append(date_str)
        return health_payload(date_str, steps=200)

    day, errors = resolve_day(
        db,
        USER_ID,
        "2026-07-18",
        TIMEZONE,
        fetch_day=fetch_day,
        now=NOW,
    )

    row = db.query(GarminDailyHealthRow).filter_by(user_id=USER_ID, date="2026-07-18").one()
    assert calls == ["2026-07-18"]
    assert day is not None and day.steps == 200
    assert errors == []
    assert row.payload["steps"] == 200
    assert row.is_complete is False


def test_complete_past_day_skips_garmin(db: Session) -> None:
    seed_day(db, "2026-07-17", steps=300, is_complete=True)
    calls: list[str] = []

    day, errors = resolve_day(
        db,
        USER_ID,
        "2026-07-17",
        TIMEZONE,
        fetch_day=lambda date_str: calls.append(date_str),
        now=NOW,
    )

    assert calls == []
    assert day is not None and day.steps == 300
    assert errors == []


def test_incomplete_past_day_refetches_and_completes(db: Session) -> None:
    seed_day(db, "2026-07-17", steps=400, is_complete=False)
    calls: list[str] = []

    def fetch_day(date_str: str) -> dict:
        calls.append(date_str)
        return health_payload(date_str, steps=500)

    day, errors = resolve_day(
        db,
        USER_ID,
        "2026-07-17",
        TIMEZONE,
        fetch_day=fetch_day,
        now=NOW,
    )

    row = db.query(GarminDailyHealthRow).filter_by(user_id=USER_ID, date="2026-07-17").one()
    assert calls == ["2026-07-17"]
    assert day is not None and day.steps == 500
    assert errors == []
    assert row.payload["steps"] == 500
    assert row.is_complete is True


def test_missing_past_day_fetches_and_persists_complete(db: Session) -> None:
    calls: list[str] = []

    def fetch_day(date_str: str) -> dict:
        calls.append(date_str)
        return health_payload(date_str, steps=600)

    day, errors = resolve_day(
        db,
        USER_ID,
        "2026-07-16",
        TIMEZONE,
        fetch_day=fetch_day,
        now=NOW,
    )

    row = db.query(GarminDailyHealthRow).filter_by(user_id=USER_ID, date="2026-07-16").one()
    assert calls == ["2026-07-16"]
    assert day is not None and day.steps == 600
    assert errors == []
    assert row.is_complete is True


def test_fetch_failure_returns_cache_without_flipping_complete(db: Session) -> None:
    seed_day(db, "2026-07-17", steps=700, is_complete=False)

    def fetch_day(_date_str: str) -> dict:
        raise RuntimeError("Garmin unavailable")

    day, errors = resolve_day(
        db,
        USER_ID,
        "2026-07-17",
        TIMEZONE,
        fetch_day=fetch_day,
        now=NOW,
    )

    row = db.query(GarminDailyHealthRow).filter_by(user_id=USER_ID, date="2026-07-17").one()
    assert day is not None and day.steps == 700
    assert [error.model_dump() for error in errors] == [
        {"date": "2026-07-17", "message": "Garmin unavailable"}
    ]
    assert row.is_complete is False


def test_fetch_failure_without_cache_returns_error(db: Session) -> None:
    def fetch_day(_date_str: str) -> dict:
        raise RuntimeError("Garmin unavailable")

    day, errors = resolve_day(
        db,
        USER_ID,
        "2026-07-17",
        TIMEZONE,
        fetch_day=fetch_day,
        now=NOW,
    )

    assert day is None
    assert [error.model_dump() for error in errors] == [
        {"date": "2026-07-17", "message": "Garmin unavailable"}
    ]


def test_future_day_returns_null_without_fetch(db: Session) -> None:
    calls: list[str] = []

    day, errors = resolve_day(
        db,
        USER_ID,
        "2026-07-19",
        TIMEZONE,
        fetch_day=lambda date_str: calls.append(date_str),
        now=NOW,
    )

    assert day is None
    assert errors == []
    assert calls == []


def test_resolve_dates_skips_executor_when_cache_complete(db: Session) -> None:
    seed_day(db, "2026-07-16", steps=160, is_complete=True)
    seed_day(db, "2026-07-17", steps=170, is_complete=True)
    calls: list[str] = []

    with patch("backend.api.health_service.ThreadPoolExecutor") as executor_cls:
        days, errors = resolve_dates(
            db,
            USER_ID,
            ["2026-07-16", "2026-07-17"],
            TIMEZONE,
            fetch_day=lambda date_str: calls.append(date_str),
            concurrency=3,
            now=NOW,
        )

    executor_cls.assert_not_called()
    assert calls == []
    assert [(day.date, day.steps) for day in days] == [
        ("2026-07-16", 160),
        ("2026-07-17", 170),
    ]
    assert errors == []


def test_resolve_dates_limits_parallel_fetches(db: Session) -> None:
    dates = [f"2026-07-{day:02d}" for day in range(11, 18)]
    in_flight = 0
    max_in_flight = 0
    lock = threading.Lock()

    def fetch_day(date_str: str) -> dict:
        nonlocal in_flight, max_in_flight
        with lock:
            in_flight += 1
            max_in_flight = max(max_in_flight, in_flight)
        time.sleep(0.05)
        with lock:
            in_flight -= 1
        return health_payload(date_str)

    days, errors = resolve_dates(
        db,
        USER_ID,
        dates,
        TIMEZONE,
        fetch_day=fetch_day,
        concurrency=3,
        now=NOW,
    )

    assert 1 < max_in_flight <= 3
    assert [day.date for day in days] == dates
    assert errors == []


def test_resolve_dates_partitions_cache_and_preserves_order(db: Session) -> None:
    seed_day(db, "2026-07-15", steps=150, is_complete=False)
    seed_day(db, "2026-07-14", steps=140, is_complete=True)
    calls: list[str] = []

    def fetch_day(date_str: str) -> dict:
        calls.append(date_str)
        if date_str == "2026-07-16":
            raise RuntimeError("Garmin unavailable")
        return health_payload(date_str, steps=int(date_str[-2:]) * 10)

    days, errors = resolve_dates(
        db,
        USER_ID,
        ["2026-07-16", "2026-07-14", "2026-07-15", "2026-07-19"],
        TIMEZONE,
        fetch_day=fetch_day,
        concurrency=2,
        now=NOW,
    )

    assert sorted(calls) == ["2026-07-15", "2026-07-16"]
    assert [(day.date, day.steps) for day in days] == [
        ("2026-07-14", 140),
        ("2026-07-15", 150),
    ]
    assert [error.model_dump() for error in errors] == [
        {"date": "2026-07-16", "message": "Garmin unavailable"}
    ]


def test_resolve_dates_clamps_non_positive_concurrency(db: Session) -> None:
    dates = ["2026-07-16", "2026-07-17"]
    first_fetch_started = threading.Event()
    allow_first_fetch_to_finish = threading.Event()
    second_started_before_first_finished = False
    lock = threading.Lock()

    def fetch_day(date_str: str) -> dict:
        nonlocal second_started_before_first_finished
        if date_str == dates[0]:
            first_fetch_started.set()
            allow_first_fetch_to_finish.wait(timeout=1)
        else:
            with lock:
                second_started_before_first_finished = not allow_first_fetch_to_finish.is_set()
        return health_payload(date_str)

    timer = threading.Timer(0.05, allow_first_fetch_to_finish.set)
    timer.start()
    try:
        days, errors = resolve_dates(
            db,
            USER_ID,
            dates,
            TIMEZONE,
            fetch_day=fetch_day,
            concurrency=0,
            now=NOW,
        )
    finally:
        timer.cancel()

    assert first_fetch_started.is_set()
    assert second_started_before_first_finished is False
    assert [day.date for day in days] == dates
    assert errors == []
