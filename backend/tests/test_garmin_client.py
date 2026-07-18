from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from garminconnect import (
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
)

from backend.api.schemas import DailyHealth
from backend.garmin_client import (
    GarminAuthFailure,
    GarminTransientError,
    _garmin_kwargs,
    call_with_retry,
    fetch_and_normalize_day,
    garmin_from_tokens,
    map_activity_type,
    map_hrv_status,
)


def test_map_hrv_status():
    assert map_hrv_status("BALANCED") == "balanced"
    assert map_hrv_status("UNBALANCED") == "unbalanced"
    assert map_hrv_status("LOW") == "low"
    assert map_hrv_status("POOR") == "poor"
    assert map_hrv_status(None) == "unavailable"


def test_call_with_retry_uses_delays(monkeypatch):
    sleeps: list[float] = []
    monkeypatch.setattr("backend.garmin_client.time.sleep", lambda s: sleeps.append(s))

    attempts = {"n": 0}

    def flaky():
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise GarminTransientError("boom")
        return "ok"

    assert call_with_retry(flaky) == "ok"
    assert attempts["n"] == 3
    assert sleeps == [1, 5]


def test_call_with_retry_classifies_garmin_errors():
    with pytest.raises(GarminAuthFailure):
        call_with_retry(
            MagicMock(side_effect=GarminConnectAuthenticationError("bad token")),
            sleep=lambda _seconds: None,
        )

    with pytest.raises(GarminTransientError):
        call_with_retry(
            MagicMock(side_effect=GarminConnectConnectionError("offline")),
            sleep=lambda _seconds: None,
            delays=(),
        )


def test_garmin_from_tokens_disables_library_retries_when_supported():
    api = MagicMock()
    tokens_json = "x" * 513

    with (
        patch("backend.garmin_client.Garmin", return_value=api) as garmin_cls,
        patch(
            "backend.garmin_client._garmin_kwargs",
            return_value={"retry_attempts": 0},
        ),
    ):
        result = garmin_from_tokens(tokens_json)

    assert result is api
    garmin_cls.assert_called_once_with(retry_attempts=0)
    api.login.assert_called_once_with(tokens_json)


def test_garmin_kwargs_omits_retry_attempts_when_unsupported():
    import inspect

    def fake_init(self, email=None, password=None):
        return None

    with patch(
        "backend.garmin_client.inspect.signature",
        return_value=inspect.signature(fake_init),
    ):
        assert _garmin_kwargs(retry_attempts=0) == {}
        assert "retry_attempts" not in inspect.signature(fake_init).parameters


@pytest.mark.parametrize(
    ("type_key", "expected"),
    [
        ("strength_training", "strength_training"),
        ("indoor_cardio", "cardio"),
        ("cardio", "cardio"),
        ("running", "running"),
        ("trail_running", "running"),
        ("treadmill_running", "running"),
        ("cycling", "cycling"),
        ("road_biking", "cycling"),
        ("indoor_cycling", "cycling"),
        ("walking", "walking"),
        ("hiking", "hiking"),
        ("unknown", "other"),
        (None, "other"),
    ],
)
def test_map_activity_type(type_key, expected):
    assert map_activity_type(type_key) == expected


def test_fetch_and_normalize_day_maps_summary_sleep_hr_hrv_activities():
    api = MagicMock()
    api.get_user_summary.return_value = {
        "totalSteps": 1000,
        "dailyStepGoal": 7000,
        "totalKilocalories": 2000,
        "activeKilocalories": 400,
        "bmrKilocalories": 1600,
        "restingHeartRate": 50,
        "minHeartRate": 45,
        "maxHeartRate": 170,
    }
    api.get_sleep_data.return_value = {
        "dailySleepDTO": {
            "sleepTimeSeconds": 25200,
            "deepSleepSeconds": 3600,
            "remSleepSeconds": 3600,
            "lightSleepSeconds": 18000,
            "avgHeartRate": 52,
            "sleepScores": {"overall": {"value": 80}},
        }
    }
    api.get_heart_rates.return_value = {
        "restingHeartRate": 49,
        "minHeartRate": 44,
        "maxHeartRate": 180,
        "lastSevenDaysAvgRestingHeartRate": 48,
    }
    api.get_hrv_data.return_value = {
        "hrvSummary": {
            "lastNightAvg": 90,
            "status": "BALANCED",
            "weeklyAvg": 88,
        }
    }
    api.get_activities_by_date.return_value = [
        {
            "activityId": 1,
            "activityName": "Run",
            "activityType": {"typeKey": "running"},
            "startTimeLocal": "2026-07-18 07:30:00",
            "duration": 1800,
            "calories": 300,
            "averageHR": 150,
            "distance": 5000,
        }
    ]

    day = fetch_and_normalize_day(api, "2026-07-18")
    assert day["date"] == "2026-07-18"
    assert day["steps"] == 1000
    assert day["stepGoal"] == 7000
    assert day["sleepHours"] == 7.0
    assert day["hrv"] == 90
    assert day["hrvStatus"] == "balanced"
    assert day["activities"][0]["type"] == "running"
    assert day["activities"][0]["startTime"] == "07:30"
    assert day["activities"][0]["distanceKm"] == 5.0
    DailyHealth.model_validate(day)


def test_fetch_and_normalize_day_uses_defaults_when_optional_calls_fail(monkeypatch):
    monkeypatch.setattr("backend.garmin_client.time.sleep", lambda _seconds: None)
    api = MagicMock()
    api.get_user_summary.return_value = {}
    optional_failure = GarminTransientError("optional unavailable")
    api.get_sleep_data.side_effect = optional_failure
    api.get_heart_rates.side_effect = optional_failure
    api.get_hrv_data.side_effect = optional_failure
    api.get_activities_by_date.side_effect = optional_failure

    day = fetch_and_normalize_day(api, "2026-07-18")

    assert day["hrvStatus"] == "unavailable"
    assert day["activities"] == []
    DailyHealth.model_validate(day)


def test_fetch_and_normalize_day_raises_when_summary_fails(monkeypatch):
    monkeypatch.setattr("backend.garmin_client.time.sleep", lambda _seconds: None)
    api = MagicMock()
    api.get_user_summary.side_effect = GarminTransientError("summary unavailable")

    with pytest.raises(GarminTransientError, match="summary unavailable"):
        fetch_and_normalize_day(api, "2026-07-18")

    assert api.get_user_summary.call_count == 4
