"""Tests for the Hevy external write endpoints (proxies to the Hevy API).

A ``FakeHevyClient`` is injected through FastAPI dependency overrides so no
network calls happen: routes must validate request bodies against Hevy's
request shapes, forward them exactly, and return Hevy's response untouched.
"""

from __future__ import annotations

import uuid

import pytest
import requests
from fastapi.testclient import TestClient

from backend.api.routes import external as external_routes
from backend.config import Settings
from backend.hevy_client import HevyAPIError
from backend.tests.conftest import register_user

ROUTINE_BODY = {
    "routine": {
        "title": "Push Day",
        "folder_id": 12345,
        "notes": "Focus on form over weight",
        "exercises": [
            {
                "exercise_template_id": "55E6546F",
                "superset_id": 1,
                "rest_seconds": 90,
                "notes": "Stay slow and controlled",
                "sets": [
                    {
                        "type": "normal",
                        "weight_kg": 40.0,
                        "reps": 10,
                        "distance_meters": None,
                        "duration_seconds": None,
                        "rep_range": {"start": 8, "end": 12},
                    }
                ],
            }
        ],
    }
}
FOLDER_BODY = {"routine_folder": {"title": "Coach Programs"}}
MEASUREMENT_BODY = {"weight_kg": 80.5, "fat_percent": 18.5}

HEVY_ROUTINE_RESPONSE = {
    "id": "routine-uuid",
    "title": "Push Day",
    "folder_id": 12345,
    "notes": "Focus on form over weight",
    "exercises": [
        {
            "index": 0,
            "exercise_template_id": "55E6546F",
            "title": "Barbell Bench Press",
            "sets": [],
        }
    ],
}

HEVY_FAILURE = HevyAPIError(
    'Hevy POST /v1/routines failed with status 400: {"errors":[{"error":"Invalid"}]}',
    status=400,
)

# (method, path, request body, forwarded client call, expected status code)
CASES = [
    ("POST", "/api/external/hevy/routines", ROUTINE_BODY, ("create_routine", ROUTINE_BODY), 201),
    (
        "PUT",
        "/api/external/hevy/routines/routine-uuid",
        ROUTINE_BODY,
        ("update_routine", ("routine-uuid", ROUTINE_BODY)),
        200,
    ),
    ("POST", "/api/external/hevy/routine-folders", FOLDER_BODY, ("create_routine_folder", FOLDER_BODY), 201),
    (
        "PUT",
        "/api/external/hevy/body-measurements/2026-11-10",
        MEASUREMENT_BODY,
        ("put_body_measurement", ("2026-11-10", MEASUREMENT_BODY)),
        200,
    ),
]
WRITE_ENDPOINTS = [(method, path, body) for method, path, body, _, _ in CASES]


class FakeHevyClient:
    """Records forwarded calls; returns a canned response or raises a canned error."""

    def __init__(self, response: dict | None = None, error: Exception | None = None) -> None:
        self.calls: list[tuple[str, object]] = []
        self.response = HEVY_ROUTINE_RESPONSE if response is None else response
        self.error = error

    def create_routine(self, body: dict) -> dict:
        return self._record("create_routine", body)

    def update_routine(self, routine_id: str, body: dict) -> dict:
        return self._record("update_routine", (routine_id, body))

    def create_routine_folder(self, body: dict) -> dict:
        return self._record("create_routine_folder", body)

    def put_body_measurement(self, date: str, body: dict) -> dict:
        return self._record("put_body_measurement", (date, body))

    def _record(self, method: str, args: object) -> dict:
        self.calls.append((method, args))
        if self.error is not None:
            raise self.error
        return self.response


@pytest.fixture()
def fake_hevy(client: TestClient) -> FakeHevyClient:
    fake = FakeHevyClient()
    client.app.dependency_overrides[external_routes.require_hevy_configured] = lambda: fake
    return fake


def _issue_key(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post("/api/settings/external-api-key", headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["apiKey"]


def _auth_headers(client: TestClient) -> dict[str, str]:
    headers = register_user(client, f"{uuid.uuid4()}@example.com")
    return {"Authorization": f"Bearer {_issue_key(client, headers)}"}


# --- success: validate, forward exactly, return Hevy's response ----------------


@pytest.mark.parametrize(("method", "path", "body", "expected_call", "status_code"), CASES)
def test_hevy_writes_forward_validated_bodies_and_return_hevy_response(
    client: TestClient, fake_hevy: FakeHevyClient, method: str, path: str, body: dict, expected_call: tuple, status_code: int
) -> None:
    auth = _auth_headers(client)

    response = client.request(method, path, json=body, headers=auth)

    assert response.status_code == status_code, response.text
    assert response.json() == HEVY_ROUTINE_RESPONSE
    assert fake_hevy.calls == [expected_call]


# --- unset rep_range is pruned; null scalars survive ----------------------------


ROUTINE_WITHOUT_REP_RANGE = {
    "routine": {
        "title": "Pull Day",
        "folder_id": None,
        "notes": None,
        "exercises": [
            {
                "exercise_template_id": "55E6546F",
                "superset_id": None,
                "rest_seconds": None,
                "notes": None,
                "sets": [
                    {
                        "type": "normal",
                        "weight_kg": 60.0,
                        "reps": 8,
                        "distance_meters": None,
                        "duration_seconds": None,
                    }
                ],
            }
        ],
    }
}


def test_routine_writes_omit_unset_rep_range_but_keep_null_scalars(
    client: TestClient, fake_hevy: FakeHevyClient
) -> None:
    """Hevy's PUT /v1/routines/{id} rejects ``"rep_range": null`` with 400
    ("Expected object, received null"), so the proxy prunes unset rep_range
    objects at every nesting level. Ordinary null scalars (notes,
    distance_meters, …) are semantically meaningful and stay forwarded as
    null."""
    auth = _auth_headers(client)

    created = client.post(
        "/api/external/hevy/routines", json=ROUTINE_WITHOUT_REP_RANGE, headers=auth
    )
    updated = client.put(
        "/api/external/hevy/routines/routine-uuid",
        json=ROUTINE_WITHOUT_REP_RANGE,
        headers=auth,
    )

    assert created.status_code == 201, created.text
    assert updated.status_code == 200, updated.text
    assert [method for method, _ in fake_hevy.calls] == ["create_routine", "update_routine"]
    for method, args in fake_hevy.calls:
        forwarded = args if method == "create_routine" else args[1]
        routine = forwarded["routine"]
        assert routine["notes"] is None
        exercise = routine["exercises"][0]
        assert exercise["notes"] is None
        assert len(exercise["sets"]) == 1
        forwarded_set = exercise["sets"][0]
        assert "rep_range" not in forwarded_set
        assert forwarded_set["distance_meters"] is None
        assert forwarded_set["duration_seconds"] is None


# --- Hevy failures map to 502 with Hevy's message ------------------------------


@pytest.mark.parametrize(("method", "path", "body"), WRITE_ENDPOINTS)
def test_hevy_api_errors_surface_as_502_with_hevy_message(
    client: TestClient, fake_hevy: FakeHevyClient, method: str, path: str, body: dict
) -> None:
    fake_hevy.error = HEVY_FAILURE
    auth = _auth_headers(client)

    response = client.request(method, path, json=body, headers=auth)

    assert response.status_code == 502
    assert response.json() == {"detail": str(HEVY_FAILURE)}


@pytest.mark.parametrize(("method", "path", "body"), WRITE_ENDPOINTS)
def test_network_failures_also_surface_as_502(
    client: TestClient, fake_hevy: FakeHevyClient, method: str, path: str, body: dict
) -> None:
    fake_hevy.error = requests.ConnectionError("Hevy unreachable")
    auth = _auth_headers(client)

    response = client.request(method, path, json=body, headers=auth)

    assert response.status_code == 502
    assert response.json() == {"detail": "Hevy unreachable"}


# --- missing hevy_api_key maps to 503 ------------------------------------------


@pytest.mark.parametrize(("method", "path", "body"), WRITE_ENDPOINTS)
def test_hevy_writes_return_503_without_configured_api_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, method: str, path: str, body: dict
) -> None:
    monkeypatch.setattr(external_routes, "get_settings", lambda: Settings(hevy_api_key=""))
    auth = _auth_headers(client)

    response = client.request(method, path, json=body, headers=auth)

    assert response.status_code == 503
    assert response.json() == {"detail": "Hevy not configured"}


# --- auth -----------------------------------------------------------------------


@pytest.mark.parametrize(("method", "path", "body"), WRITE_ENDPOINTS)
def test_hevy_writes_require_external_api_key(client: TestClient, method: str, path: str, body: dict) -> None:
    assert client.request(method, path, json=body).status_code == 401


# --- request validation (pydantic, before anything reaches Hevy) ----------------


def test_create_routine_rejects_missing_exercise_template_id(
    client: TestClient, fake_hevy: FakeHevyClient
) -> None:
    auth = _auth_headers(client)
    body = {"routine": {"title": "Broken", "exercises": [{"superset_id": None, "notes": None, "sets": []}]}}

    response = client.post("/api/external/hevy/routines", json=body, headers=auth)

    assert response.status_code == 422
    assert fake_hevy.calls == []


def test_routine_and_folder_bodies_must_match_hevy_wrappers(
    client: TestClient, fake_hevy: FakeHevyClient
) -> None:
    auth = _auth_headers(client)

    assert client.post("/api/external/hevy/routines", json={"title": "Unwrapped"}, headers=auth).status_code == 422
    assert (
        client.put("/api/external/hevy/routines/routine-uuid", json={"routine": {"exercises": []}}, headers=auth).status_code
        == 422
    )
    assert client.post("/api/external/hevy/routine-folders", json={"title": "Unwrapped"}, headers=auth).status_code == 422
    assert client.post("/api/external/hevy/routine-folders", json={"routine_folder": {}}, headers=auth).status_code == 422
    assert fake_hevy.calls == []


def test_body_measurement_forwards_only_sent_fields_including_explicit_nulls(
    client: TestClient, fake_hevy: FakeHevyClient
) -> None:
    auth = _auth_headers(client)

    response = client.put(
        "/api/external/hevy/body-measurements/2026-11-10",
        json={"weight_kg": None, "fat_percent": 18.5},
        headers=auth,
    )

    assert response.status_code == 200
    assert fake_hevy.calls == [("put_body_measurement", ("2026-11-10", {"weight_kg": None, "fat_percent": 18.5}))]


def test_body_measurement_rejects_malformed_date(client: TestClient, fake_hevy: FakeHevyClient) -> None:
    auth = _auth_headers(client)

    response = client.put(
        "/api/external/hevy/body-measurements/not-a-date",
        json={"weight_kg": 80.5},
        headers=auth,
    )

    assert response.status_code == 400
    assert fake_hevy.calls == []


def test_routine_unknown_fields_are_rejected_not_dropped(client: TestClient, fake_hevy: FakeHevyClient) -> None:
    auth = _auth_headers(client)
    bad_bodies = [
        {"routine": {"title": "X", "exercizes": []}},  # typo'd exercises key
        {"routine": ROUTINE_BODY["routine"], "idempotency_key": "abc"},  # top-level extra
        {"routine": {"title": "X", "exercises": [{"exercise_template_id": "55E6546F", "setz": []}]}},  # typo'd sets
        {
            "routine": {
                "title": "X",
                "exercises": [{"exercise_template_id": "55E6546F", "sets": [{"type": "normal", "wieght_kg": 40.0}]}],
            }  # typo'd weight_kg inside a set
        },
        {
            "routine": {
                "title": "X",
                "exercises": [{"exercise_template_id": "55E6546F", "sets": [{"type": "normal", "rep_range": {"strt": 8}}]}],
            }  # typo'd start inside rep_range
        },
    ]

    for body in bad_bodies:
        assert client.post("/api/external/hevy/routines", json=body, headers=auth).status_code == 422
    assert (
        client.put(
            "/api/external/hevy/routines/routine-uuid",
            json={"routine": {"title": "X", "notez": "hi"}},
            headers=auth,
        ).status_code
        == 422
    )
    assert fake_hevy.calls == []


def test_folder_unknown_fields_are_rejected_not_dropped(client: TestClient, fake_hevy: FakeHevyClient) -> None:
    auth = _auth_headers(client)

    response = client.post(
        "/api/external/hevy/routine-folders",
        json={"routine_folder": {"title": "Coach Programs", "color": "red"}},
        headers=auth,
    )

    assert response.status_code == 422
    assert fake_hevy.calls == []


def test_body_measurement_unknown_fields_are_rejected_not_dropped(client: TestClient, fake_hevy: FakeHevyClient) -> None:
    auth = _auth_headers(client)

    # A typo'd field must 422 locally: forwarding an empty/partial dict would let
    # Hevy wipe the date's measurements and answer 200 OK.
    wrong_name = client.put(
        "/api/external/hevy/body-measurements/2026-11-10",
        json={"body_fat_percentage": 20.0},  # plausible misspelling of Hevy's fat_percent
        headers=auth,
    )
    assert wrong_name.status_code == 422

    extra_field = client.put(
        "/api/external/hevy/body-measurements/2026-11-10",
        json={"weight_kg": 80.5, "unit": "kg"},
        headers=auth,
    )
    assert extra_field.status_code == 422

    assert fake_hevy.calls == []
