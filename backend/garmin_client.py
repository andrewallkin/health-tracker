from __future__ import annotations

import inspect
import time
from collections.abc import Callable
from typing import Any, TypeVar

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

RETRY_DELAYS = (1, 5, 10)
_DEFAULT_SLEEP = time.sleep

_T = TypeVar("_T")


class GarminTransientError(Exception):
    """Raised when a Garmin request may succeed if retried."""


class GarminAuthFailure(Exception):
    """Raised when Garmin rejects the stored authentication."""


def call_with_retry(
    fn: Callable[..., _T],
    *args: Any,
    sleep: Callable[[float], None] = time.sleep,
    delays: tuple[float, ...] = RETRY_DELAYS,
    **kwargs: Any,
) -> _T:
    """Call a Garmin operation, retrying transient failures."""
    sleep_fn = time.sleep if sleep is _DEFAULT_SLEEP else sleep

    for attempt in range(len(delays) + 1):
        try:
            return fn(*args, **kwargs)
        except (GarminAuthFailure, GarminConnectAuthenticationError) as exc:
            if isinstance(exc, GarminAuthFailure):
                raise
            raise GarminAuthFailure(str(exc)) from exc
        except (
            GarminTransientError,
            GarminConnectConnectionError,
            GarminConnectTooManyRequestsError,
        ) as exc:
            transient = (
                exc
                if isinstance(exc, GarminTransientError)
                else GarminTransientError(str(exc))
            )
            if attempt >= len(delays):
                if transient is exc:
                    raise
                raise transient from exc
            sleep_fn(delays[attempt])

    raise RuntimeError("unreachable")  # pragma: no cover


def _garmin_kwargs(*, retry_attempts: int = 0) -> dict[str, Any]:
    """Build Garmin() kwargs supported by the installed garminconnect version.

    0.3.6+ accepts retry_attempts; 0.3.2 (Python <3.12 lock) does not.
    """
    params = inspect.signature(Garmin.__init__).parameters
    kwargs: dict[str, Any] = {}
    if "retry_attempts" in params:
        kwargs["retry_attempts"] = retry_attempts
    return kwargs


def garmin_from_tokens(tokens_json: str) -> Garmin:
    """Create an authenticated Garmin client from an inline tokenstore."""
    api = Garmin(**_garmin_kwargs(retry_attempts=0))
    call_with_retry(api.login, tokens_json)
    return api


def map_hrv_status(raw: str | None) -> str:
    """Map Garmin HRV status values to the API's curated status set."""
    if not raw:
        return "unavailable"
    normalized = raw.lower()
    if normalized in {"balanced", "unbalanced", "low", "poor"}:
        return normalized
    return "unavailable"


_ACTIVITY_TYPE_MAP = {
    "strength_training": "strength_training",
    "indoor_cardio": "cardio",
    "cardio": "cardio",
    "running": "running",
    "trail_running": "running",
    "treadmill_running": "running",
    "cycling": "cycling",
    "road_biking": "cycling",
    "indoor_cycling": "cycling",
    "walking": "walking",
    "hiking": "hiking",
}


def map_activity_type(type_key: str | None) -> str:
    """Map a Garmin activity type key to the API's activity type set."""
    if not type_key:
        return "other"
    return _ACTIVITY_TYPE_MAP.get(type_key, "other")


def _optional_call(fn: Callable[..., _T], *args: Any) -> _T | None:
    try:
        return call_with_retry(fn, *args)
    except GarminTransientError:
        return None


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _number(value: Any, default: int | float = 0) -> Any:
    return value if isinstance(value, (int, float)) else default


def _seconds_to_hours(value: Any) -> float:
    return round(_number(value) / 3600, 1)


def _normalize_activities(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return [activity for activity in raw if isinstance(activity, dict)]
    if isinstance(raw, dict):
        for key in ("activityList", "activities", "ActivitiesForDay"):
            activities = raw.get(key)
            if isinstance(activities, list):
                return [
                    activity for activity in activities if isinstance(activity, dict)
                ]
    return []


def _activity_payload(activity: dict[str, Any]) -> dict[str, Any]:
    activity_type = _dict(activity.get("activityType"))
    start_local = activity.get("startTimeLocal")
    start_local = start_local if isinstance(start_local, str) else ""
    start_time = (
        start_local.split(" ", maxsplit=1)[1][:5]
        if " " in start_local
        else start_local[:5]
    )
    duration = _number(activity.get("duration"))
    distance = activity.get("distance")

    return {
        "id": str(activity.get("activityId") or ""),
        "name": str(activity.get("activityName") or ""),
        "type": map_activity_type(activity_type.get("typeKey")),
        "startTime": start_time,
        "durationMin": round(duration / 60) if duration else 0,
        "calories": round(_number(activity.get("calories"))),
        "avgHr": round(
            _number(activity.get("avgHR") or activity.get("averageHR"))
        ),
        "distanceKm": (
            round(_number(distance) / 1000, 2)
            if isinstance(distance, (int, float)) and distance
            else None
        ),
    }


def fetch_and_normalize_day(api: Garmin, date_str: str) -> dict[str, Any]:
    """Fetch and normalize one Garmin day into a DailyHealth payload."""
    summary = _dict(call_with_retry(api.get_user_summary, date_str))
    sleep = _dict(_optional_call(api.get_sleep_data, date_str))
    heart_rates = _dict(_optional_call(api.get_heart_rates, date_str))
    hrv = _dict(_optional_call(api.get_hrv_data, date_str))
    activities_raw = _optional_call(
        api.get_activities_by_date,
        date_str,
        date_str,
    )

    sleep_dto = _dict(sleep.get("dailySleepDTO"))
    sleep_scores = _dict(sleep_dto.get("sleepScores"))
    overall_sleep_score = _dict(sleep_scores.get("overall"))
    hrv_summary = _dict(hrv.get("hrvSummary"))

    return {
        "date": date_str,
        "steps": round(_number(summary.get("totalSteps"))),
        "stepGoal": round(_number(summary.get("dailyStepGoal"))),
        "totalCalories": round(_number(summary.get("totalKilocalories"))),
        "activeCalories": round(_number(summary.get("activeKilocalories"))),
        "bmrCalories": round(_number(summary.get("bmrKilocalories"))),
        "restingHr": round(
            _number(
                heart_rates.get("restingHeartRate")
                or summary.get("restingHeartRate")
            )
        ),
        "minHr": round(
            _number(heart_rates.get("minHeartRate") or summary.get("minHeartRate"))
        ),
        "maxHr": round(
            _number(heart_rates.get("maxHeartRate") or summary.get("maxHeartRate"))
        ),
        "avgRestingHr7d": round(
            _number(heart_rates.get("lastSevenDaysAvgRestingHeartRate"))
        ),
        "sleepHours": _seconds_to_hours(sleep_dto.get("sleepTimeSeconds")),
        "deepSleepHours": _seconds_to_hours(sleep_dto.get("deepSleepSeconds")),
        "remSleepHours": _seconds_to_hours(sleep_dto.get("remSleepSeconds")),
        "lightSleepHours": _seconds_to_hours(sleep_dto.get("lightSleepSeconds")),
        "sleepAvgHr": round(_number(sleep_dto.get("avgHeartRate"))),
        "sleepScore": overall_sleep_score.get("value"),
        "hrv": hrv_summary.get("lastNightAvg"),
        "hrvStatus": map_hrv_status(hrv_summary.get("status")),
        "hrvWeeklyAvg": hrv_summary.get("weeklyAvg"),
        "activities": [
            _activity_payload(activity)
            for activity in _normalize_activities(activities_raw)
        ],
    }
