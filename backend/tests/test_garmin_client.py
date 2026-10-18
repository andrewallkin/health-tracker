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
    _normalize_body_battery,
    _normalize_endurance_score,
    _normalize_fitness_age,
    _normalize_hill_score,
    _normalize_intensity_minutes,
    _normalize_respiration,
    _normalize_spo2,
    _normalize_stress,
    _normalize_training_readiness,
    _normalize_training_status,
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
    assert day["trainingReadiness"] is None
    assert day["trainingStatus"] is None
    assert day["bodyBattery"] is None
    assert day["stress"] is None
    assert day["enduranceScore"] is None
    assert day["intensityMinutes"] is None
    assert day["hillScore"] is None
    assert day["fitnessAge"] is None
    assert day["respiration"] is None
    assert day["spo2"] is None
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
    assert day["trainingReadiness"] is None
    assert day["trainingStatus"] is None
    assert day["bodyBattery"] is None
    assert day["stress"] is None
    assert day["enduranceScore"] is None
    assert day["intensityMinutes"] is None
    assert day["hillScore"] is None
    assert day["fitnessAge"] is None
    assert day["respiration"] is None
    assert day["spo2"] is None
    DailyHealth.model_validate(day)


def test_fetch_and_normalize_day_raises_when_summary_fails(monkeypatch):
    monkeypatch.setattr("backend.garmin_client.time.sleep", lambda _seconds: None)
    api = MagicMock()
    api.get_user_summary.side_effect = GarminTransientError("summary unavailable")

    with pytest.raises(GarminTransientError, match="summary unavailable"):
        fetch_and_normalize_day(api, "2026-07-18")

    assert api.get_user_summary.call_count == 4


READINESS_RAW = [{
    "userProfilePK": 71924392, "calendarDate": "2026-10-17",
    "deviceId": 3457521672, "level": "MODERATE", "score": 64,
    "sleepScore": 71, "sleepScoreFactorPercent": 56,
    "recoveryTime": 1, "recoveryTimeFactorPercent": 99,
    "acwrFactorPercent": 94, "acuteLoad": 395,
}, {
    "userProfilePK": 71924392, "calendarDate": "2026-10-17",
    "deviceId": 999, "level": "HIGH", "score": 80,
    "sleepScore": 80, "sleepScoreFactorPercent": 60,
    "recoveryTime": 2, "recoveryTimeFactorPercent": 90,
    "acwrFactorPercent": 90, "acuteLoad": 400, "primaryTrainingDevice": False,
}]


def test_normalize_training_readiness_prefers_primary_device():
    assert _normalize_training_readiness(READINESS_RAW) == {
        "score": 64, "level": "MODERATE", "sleepScore": 71,
        "sleepFactorPercent": 56, "recoveryTime": 1, "recoveryTimeHours": 0.0,
        "recoveryFactorPercent": 99, "acwrFactorPercent": 94, "acuteLoad": 395,
    }


def test_normalize_training_readiness_recover_time_minutes():
    entry = dict(READINESS_RAW[0], recoveryTime=4320)
    result = _normalize_training_readiness([entry])
    assert result["recoveryTime"] == 4320
    assert result["recoveryTimeHours"] == 72.0


def test_normalize_training_readiness_empty_and_garbage():
    assert _normalize_training_readiness([]) is None
    assert _normalize_training_readiness(None) is None
    assert _normalize_training_readiness("nope") is None


STATUS_RAW = {
    "mostRecentVO2Max": {"generic": {"calendarDate": "2026-10-16",
        "vo2MaxValue": 53.0, "vo2MaxPreciseValue": 52.8}, "cycling": None},
    "mostRecentTrainingStatus": {"latestTrainingStatusData": {
        "3457521672": {"calendarDate": "2026-10-17", "deviceId": 3457521672,
            "trainingStatus": 4, "trainingStatusFeedbackPhrase": "MAINTAINING_2",
            "sinceDate": "2026-10-12", "sport": "RUNNING",
            "primaryTrainingDevice": True, "trainingPaused": False,
            "acuteTrainingLoadDTO": {
                "dailyTrainingLoadAcute": 395, "dailyTrainingLoadChronic": 428.0,
                "dailyAcuteChronicWorkloadRatio": 0.9, "acwrPercent": 38,
                "acwrStatus": "OPTIMAL"}}}},
    "mostRecentTrainingLoadBalance": {"metricsTrainingLoadBalanceDTOMap": {
        "3457521672": {"calendarDate": "2026-10-17", "deviceId": 3457521672,
            "monthlyLoadAerobicLow": 1290.4142, "monthlyLoadAerobicHigh": 102.12279,
            "monthlyLoadAnaerobic": 242.85545,
            "monthlyLoadAerobicLowTargetMin": 405, "monthlyLoadAerobicLowTargetMax": 924,
            "monthlyLoadAerobicHighTargetMin": 547, "monthlyLoadAerobicHighTargetMax": 1066,
            "monthlyLoadAnaerobicTargetMin": 173, "monthlyLoadAnaerobicTargetMax": 519,
            "trainingBalanceFeedbackPhrase": "AEROBIC_HIGH_SHORTAGE",
            "primaryTrainingDevice": True}}},
}


def test_normalize_training_status_primary_device():
    assert _normalize_training_status(STATUS_RAW) == {
        "vo2Max": 53.0, "vo2MaxPrecise": 52.8, "vo2MaxDate": "2026-10-16",
        "statusCode": 4, "statusPhrase": "MAINTAINING_2", "statusDate": "2026-10-17",
        "acuteLoad": 395, "chronicLoad": 428.0,
        "acwr": 0.9, "acwrPercent": 38, "acwrStatus": "OPTIMAL",
        "loadBalance": {
            "aerobicLow": 1290.4, "aerobicHigh": 102.1, "anaerobic": 242.9,
            "aerobicLowTarget": [405, 924], "aerobicHighTarget": [547, 1066],
            "anaerobicTarget": [173, 519], "feedbackPhrase": "AEROBIC_HIGH_SHORTAGE",
        },
    }


def test_normalize_training_status_missing_pieces():
    assert _normalize_training_status({}) is None
    partial = {"mostRecentTrainingStatus": {"latestTrainingStatusData": {
        "1": {"calendarDate": "2026-10-17", "trainingStatus": 4}}}}
    result = _normalize_training_status(partial)
    assert result["statusCode"] == 4
    assert result["loadBalance"] is None and result["vo2Max"] is None


BODY_BATTERY_RAW = [{"date": "2026-10-17", "charged": 59, "drained": 41,
                     "bodyBatteryHighestValue": 81, "bodyBatteryLowestValue": 22}]

STRESS_RAW = {"calendarDate": "2026-10-17", "avgStressLevel": 28, "maxStressLevel": 95}


def test_normalize_body_battery():
    raw = [{"date": "2026-10-17", "charged": 59, "drained": 41,
            "bodyBatteryHighestValue": 81, "bodyBatteryLowestValue": 22}]
    assert _normalize_body_battery(raw) == {
        "charged": 59, "drained": 41, "highest": 81, "lowest": 22}
    assert _normalize_body_battery([]) is None


def test_normalize_stress():
    raw = {"calendarDate": "2026-10-17", "avgStressLevel": 28, "maxStressLevel": 95}
    assert _normalize_stress(raw) == {"avg": 28, "max": 95}
    assert _normalize_stress({"avgStressLevel": None}) is None


def test_normalize_endurance_score():
    raw = {"calendarDate": "2026-10-17", "overallScore": 6064, "classification": 3}
    assert _normalize_endurance_score(raw) == {"overall": 6064, "classification": 3}
    assert _normalize_endurance_score({}) is None


def test_normalize_endurance_score_historical_without_classification():
    assert _normalize_endurance_score({"overallScore": 6653}) == {
        "overall": 6653, "classification": None}


def test_normalize_intensity_minutes():
    raw = {"calendarDate": "2026-10-17", "moderateMinutes": 0, "vigorousMinutes": 0,
           "weeklyModerate": 158, "weeklyVigorous": 220, "weeklyTotal": 598, "weekGoal": 300}
    assert _normalize_intensity_minutes(raw) == {
        "moderate": 0, "vigorous": 0, "weeklyModerate": 158,
        "weeklyVigorous": 220, "weeklyTotal": 598, "weekGoal": 300}
    assert _normalize_intensity_minutes({}) is None


def test_normalize_hill_score():
    raw = {"calendarDate": "2026-10-17", "strengthScore": 41,
           "enduranceScore": 32, "overallScore": 46}
    assert _normalize_hill_score(raw) == {"strength": 41, "endurance": 32, "overall": 46}
    assert _normalize_hill_score({}) is None


def test_normalize_fitness_age():
    raw = {"chronologicalAge": 26, "fitnessAge": 18.0}
    assert _normalize_fitness_age(raw) == {"fitnessAge": 18.0, "chronologicalAge": 26}
    assert _normalize_fitness_age({"fitnessAge": None}) is None


def test_normalize_respiration():
    raw = {"avgSleepRespirationValue": 13.4}
    assert _normalize_respiration(raw) == {"avgSleep": 13.4}
    assert _normalize_respiration({"avgSleepRespirationValue": None}) is None


def test_normalize_spo2():
    raw = {"avgSleepSpO2": 96.0, "lastSevenDaysAvgSpO2": 95.0}
    assert _normalize_spo2(raw) == {"avgSleep": 96.0, "avg7d": 95.0}
    assert _normalize_spo2({}) is None


def test_normalize_spo2_historical_without_avg_sleep():
    assert _normalize_spo2({"lastSevenDaysAvgSpO2": 95.7}) == {
        "avgSleep": None, "avg7d": 95.7}


ENDURANCE_RAW = {"calendarDate": "2026-10-17", "overallScore": 6064, "classification": 3}
INTENSITY_RAW = {"calendarDate": "2026-10-17", "moderateMinutes": 0, "vigorousMinutes": 0,
                 "weeklyModerate": 158, "weeklyVigorous": 220, "weeklyTotal": 598,
                 "weekGoal": 300}
HILL_RAW = {"calendarDate": "2026-10-17", "strengthScore": 41,
            "enduranceScore": 32, "overallScore": 46}
FITNESS_AGE_RAW = {"chronologicalAge": 26, "fitnessAge": 18.0}
RESPIRATION_RAW = {"avgSleepRespirationValue": 13.4}
SPO2_RAW = {"avgSleepSpO2": 96.0, "lastSevenDaysAvgSpO2": 95.0}


def test_fetch_and_normalize_day_includes_second_tier_blocks():
    api = MagicMock()
    api.get_endurance_score.return_value = ENDURANCE_RAW
    api.get_intensity_minutes_data.return_value = INTENSITY_RAW
    api.get_hill_score.return_value = HILL_RAW
    api.get_fitnessage_data.return_value = FITNESS_AGE_RAW
    api.get_respiration_data.return_value = RESPIRATION_RAW
    api.get_spo2_data.return_value = SPO2_RAW

    day = fetch_and_normalize_day(api, "2026-10-17")

    assert day["enduranceScore"] == {"overall": 6064, "classification": 3}
    assert day["intensityMinutes"] == {
        "moderate": 0, "vigorous": 0, "weeklyModerate": 158,
        "weeklyVigorous": 220, "weeklyTotal": 598, "weekGoal": 300}
    assert day["hillScore"] == {"strength": 41, "endurance": 32, "overall": 46}
    assert day["fitnessAge"] == {"fitnessAge": 18.0, "chronologicalAge": 26}
    assert day["respiration"] == {"avgSleep": 13.4}
    assert day["spo2"] == {"avgSleep": 96.0, "avg7d": 95.0}
    DailyHealth.model_validate(day)


def test_fetch_and_normalize_day_includes_readiness_status_battery_stress():
    api = MagicMock()
    api.get_training_readiness.return_value = READINESS_RAW
    api.get_training_status.return_value = STATUS_RAW
    api.get_body_battery.return_value = BODY_BATTERY_RAW
    api.get_stress_data.return_value = STRESS_RAW

    day = fetch_and_normalize_day(api, "2026-10-17")

    assert day["trainingReadiness"] == {
        "score": 64, "level": "MODERATE", "sleepScore": 71,
        "sleepFactorPercent": 56, "recoveryTime": 1, "recoveryTimeHours": 0.0,
        "recoveryFactorPercent": 99, "acwrFactorPercent": 94, "acuteLoad": 395,
    }
    assert day["trainingStatus"]["statusCode"] == 4
    assert day["trainingStatus"]["loadBalance"]["anaerobic"] == 242.9
    assert day["bodyBattery"] == {"charged": 59, "drained": 41, "highest": 81, "lowest": 22}
    assert day["stress"] == {"avg": 28, "max": 95}
