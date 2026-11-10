from __future__ import annotations

import json
from unittest.mock import MagicMock, call, patch

import pytest

from backend.config import Settings
from backend.hevy_client import HevyAPIError, HevyClient, hevy_client_from_settings

BASE_URL = "https://api.hevyapp.com"


def _mock_response(status_code: int, body: dict | None = None, text: str = ""):
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = body if body is not None else {}
    response.text = text or json.dumps(body) if body is not None else text
    response.content = b"payload" if body is not None else b""
    return response


def test_client_sends_api_key_header():
    client = HevyClient("secret-key")

    with patch("requests.Session.request", return_value=_mock_response(200, {})) as request:
        client.get_user_info()

    assert request.call_count == 1
    assert request.call_args.args[0] == "GET"
    assert request.call_args.args[1] == f"{BASE_URL}/v1/user/info"
    assert request.call_args.kwargs["headers"]["api-key"] == "secret-key"


def test_paginated_gets_send_page_and_pagesize_params():
    client = HevyClient("k")

    with patch("requests.Session.request", return_value=_mock_response(200, {})) as request:
        client.get_workouts(page=2)
        client.get_workout_events(page=3, page_size=5)
        client.get_exercise_templates()
        client.get_routines()
        client.get_routine_folders()

    actual = [(c.args[1], c.kwargs["params"]) for c in request.call_args_list]
    assert actual == [
        (f"{BASE_URL}/v1/workouts", {"page": 2, "pageSize": 10}),
        (f"{BASE_URL}/v1/workouts/events", {"page": 3, "pageSize": 5}),
        (f"{BASE_URL}/v1/exercise_templates", {"page": 1, "pageSize": 10}),
        (f"{BASE_URL}/v1/routines", {"page": 1, "pageSize": 10}),
        (f"{BASE_URL}/v1/routine_folders", {"page": 1, "pageSize": 10}),
    ]


def test_page_size_is_capped_at_ten():
    client = HevyClient("k")

    with patch("requests.Session.request", return_value=_mock_response(200, {})) as request:
        client.get_workouts(page_size=25)
        client.get_workout_events(page_size=25)
        client.get_exercise_templates(page_size=25)
        client.get_routines(page_size=25)
        client.get_routine_folders(page_size=25)

    # Binding constraint: the client must never exceed Hevy's pageSize cap of
    # 10, whatever callers pass in.
    assert [c.kwargs["params"]["pageSize"] for c in request.call_args_list] == [10] * 5


def test_write_methods_use_hevy_paths_and_methods():
    client = HevyClient("k")
    routine_body = {"routine": {"title": "Push Day"}}
    folder_body = {"title": "Coach Programs"}
    measurement_body = {"weight_kg": 80.5}

    with patch("requests.Session.request", return_value=_mock_response(200, {})) as request:
        client.create_routine(routine_body)
        client.update_routine("routine-uuid", routine_body)
        client.create_routine_folder(folder_body)
        client.put_body_measurement("2026-11-10", measurement_body)

    bodies = [c.kwargs["json"] for c in request.call_args_list]
    assert bodies == [routine_body, routine_body, folder_body, measurement_body]
    assert [(c.args[0], c.args[1]) for c in request.call_args_list] == [
        ("POST", f"{BASE_URL}/v1/routines"),
        ("PUT", f"{BASE_URL}/v1/routines/routine-uuid"),
        ("POST", f"{BASE_URL}/v1/routine_folders"),
        ("PUT", f"{BASE_URL}/v1/body_measurements/2026-11-10"),
    ]


def test_get_workout_returns_body_on_success():
    payload = {"id": "w1", "title": "Push Day"}

    with patch(
        "requests.Session.request",
        return_value=_mock_response(200, payload),
    ) as request:
        assert HevyClient("k").get_workout("w1") == payload

    assert request.call_args.args[1] == f"{BASE_URL}/v1/workouts/w1"


def test_get_workout_returns_none_on_404():
    response = _mock_response(404, text='{"error": "Workout not found"}')

    with patch("requests.Session.request", return_value=response):
        assert HevyClient("k").get_workout("missing") is None


def test_non_2xx_raises_hevy_api_error_with_status_and_snippet():
    response = _mock_response(429, text="rate limited: slow down")
    client = HevyClient("k")

    with (
        patch("requests.Session.request", return_value=response),
        pytest.raises(HevyAPIError) as exc_info,
    ):
        client.get_workouts()

    message = str(exc_info.value)
    assert "429" in message
    assert "rate limited" in message
    assert exc_info.value.status == 429


def test_get_workout_reraises_non_404_errors():
    response = _mock_response(500, text="boom")
    client = HevyClient("k")

    with (
        patch("requests.Session.request", return_value=response),
        pytest.raises(HevyAPIError) as exc_info,
    ):
        client.get_workout("w1")

    assert exc_info.value.status == 500


def test_get_body_measurement_returns_body_on_success():
    payload = {"date": "2026-11-10", "weight_kg": 80.5, "fat_percent": 18.5}

    with patch(
        "requests.Session.request",
        return_value=_mock_response(200, payload),
    ) as request:
        assert HevyClient("k").get_body_measurement("2026-11-10") == payload

    assert request.call_args.args[1] == f"{BASE_URL}/v1/body_measurements/2026-11-10"


def test_get_body_measurement_returns_none_on_404():
    response = _mock_response(404, text='{"error": "Not found"}')

    with patch("requests.Session.request", return_value=response):
        assert HevyClient("k").get_body_measurement("2026-11-10") is None


def test_get_body_measurement_reraises_non_404_errors():
    response = _mock_response(500, text="boom")

    with (
        patch("requests.Session.request", return_value=response),
        pytest.raises(HevyAPIError) as exc_info,
    ):
        HevyClient("k").get_body_measurement("2026-11-10")

    assert exc_info.value.status == 500


def test_consecutive_requests_are_separated_by_one_second():
    client = HevyClient("k")

    with (
        patch("requests.Session.request", return_value=_mock_response(200, {})),
        patch(
            "backend.hevy_client.time.monotonic",
            side_effect=[100.0, 100.0, 100.25, 101.0],
        ),
        patch("backend.hevy_client.time.sleep") as sleep,
    ):
        client.get_workouts()
        client.get_workouts()

    # Second call was issued 0.25s after the first, so the client waits the
    # remaining 0.75s to keep >=1s spacing (start 100.0 -> start ~101.0).
    assert sleep.call_args_list == [call(0.75)]


def test_throttle_skips_sleep_when_interval_already_elapsed():
    client = HevyClient("k")

    with (
        patch("requests.Session.request", return_value=_mock_response(200, {})),
        patch(
            "backend.hevy_client.time.monotonic",
            side_effect=[50.0, 50.0, 60.0, 60.0],
        ),
        patch("backend.hevy_client.time.sleep") as sleep,
    ):
        client.get_routines()
        client.get_routines()

    sleep.assert_not_called()


def test_hevy_client_from_settings_returns_none_without_key():
    settings = Settings(hevy_api_key="", hevy_webhook_token="")

    assert hevy_client_from_settings(settings) is None


def test_hevy_client_from_settings_builds_client_with_key():
    settings = Settings(hevy_api_key="key-123")

    client = hevy_client_from_settings(settings)

    assert isinstance(client, HevyClient)
    with patch("requests.Session.request", return_value=_mock_response(200, {})) as request:
        client.get_user_info()
    assert request.call_args.kwargs["headers"]["api-key"] == "key-123"
