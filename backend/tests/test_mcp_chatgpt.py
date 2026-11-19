from __future__ import annotations

import asyncio
import hashlib
import hmac
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from fastmcp.server.auth import MultiAuth
from mcp.shared.auth import OAuthClientInformationFull
from pydantic import AnyUrl
from starlette.applications import Starlette

from backend.api.routes import external as external_routes
from backend.config import get_settings
from backend.mcp import external_tools, server
from backend.mcp.auth import McpAuthError
from backend.mcp.oauth_provider import HEALTH_AUTH_COOKIE, OwnerOAuthProvider, SCOPE
from backend.mcp.oauth_store import MemoryOAuthRepository
from backend.mcp.token_hash import hash_oauth_token

AUTHORIZE = {
    "client_id": "chatgpt",
    "redirect_uri": "https://chatgpt.com/connector/oauth/callback",
    "response_type": "code",
    "code_challenge": "a" * 43,
    "code_challenge_method": "S256",
    "state": "xyz",
    "scope": SCOPE,
    "resource": "http://127.0.0.1:8000/mcp",
}

USER_ID = "11111111-1111-1111-1111-111111111111"


def _provider(owner_id: str | None) -> OwnerOAuthProvider:
    provider = OwnerOAuthProvider(
        "http://127.0.0.1:8000",
        repository=MemoryOAuthRepository(),
        owner_lookup=lambda _request: owner_id,
    )
    client = OAuthClientInformationFull(
        client_id="chatgpt",
        redirect_uris=[AnyUrl("https://chatgpt.com/connector/oauth/callback")],
        token_endpoint_auth_method="none",
        scope=SCOPE,
    )
    asyncio.run(provider.register_client(client))
    return provider


def _oauth_client(provider: OwnerOAuthProvider) -> TestClient:
    return TestClient(Starlette(routes=provider.get_routes("/mcp")))


def test_metadata_advertises_public_pkce_and_refresh() -> None:
    response = _oauth_client(_provider(None)).get("/.well-known/oauth-authorization-server")

    assert response.status_code == 200
    body = response.json()
    assert "none" in body["token_endpoint_auth_methods_supported"]
    assert body["code_challenge_methods_supported"] == ["S256"]
    assert "refresh_token" in body["grant_types_supported"]
    assert body["authorization_endpoint"] == "http://127.0.0.1:8000/authorize"


def test_anonymous_authorize_does_not_issue_a_code() -> None:
    provider = _provider(None)
    response = _oauth_client(provider).post("/authorize", params=AUTHORIZE, data={"decision": "allow"})

    assert response.status_code == 200
    assert "Sign in first" in response.text
    assert provider.repository.codes == {}


def test_owner_approval_issues_a_code_for_that_user_only() -> None:
    provider = _provider(USER_ID)
    response = _oauth_client(provider).post(
        "/authorize", params=AUTHORIZE, data={"decision": "allow"}, follow_redirects=False
    )

    assert response.status_code == 302
    location = response.headers["location"]
    assert "code=" in location
    raw_code = location.split("code=", 1)[1].split("&", 1)[0]
    stored = provider.repository.get_code(raw_code, "chatgpt")
    assert stored is not None
    assert stored.user_id == USER_ID

    client = asyncio.run(provider.get_client("chatgpt"))
    token = asyncio.run(provider.exchange_authorization_code(client, stored.code))
    assert provider.repository.user_id_for_access_token(token.access_token) == USER_ID
    assert provider.repository.get_code(raw_code, "chatgpt") is None


def test_login_sets_health_auth_and_refresh_token(client) -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": "mcp@example.com", "password": "password123"},
    )
    assert response.status_code == 201
    assert response.cookies.get("refresh_token")
    assert response.cookies.get(HEALTH_AUTH_COOKIE)
    access = response.json()["access_token"]
    assert response.cookies.get(HEALTH_AUTH_COOKIE) == access


def test_mcp_server_exposes_fastmcp_instance_with_auth() -> None:
    assert server.mcp is not None
    assert server.mcp.name == "health-tracker"
    assert isinstance(server.mcp.auth, MultiAuth)
    assert isinstance(server.mcp.auth.server, OwnerOAuthProvider)


def test_oauth_token_hash_uses_jwt_secret_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET_KEY", "hash-secret")
    get_settings.cache_clear()
    try:
        expected = hmac.new(b"hash-secret", b"raw-key", hashlib.sha256).hexdigest()
        assert hash_oauth_token("raw-key") == expected
    finally:
        get_settings.cache_clear()


def test_invoke_external_reports_auth_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.mcp.external_tools.require_mcp_user", lambda: (_ for _ in ()).throw(McpAuthError("no key")))
    result = external_tools.invoke_external(lambda **kwargs: {"ok": True})
    assert result == {"error": {"code": "unauthorized", "message": "no key"}}


def test_invoke_external_maps_http_exception(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.mcp.external_tools.require_mcp_user", lambda: MagicMock())

    def bad_operation(**kwargs):
        raise HTTPException(status_code=404, detail="Workout not found")

    result = external_tools.invoke_external(bad_operation)
    assert result == {"error": {"code": "not_found", "message": "Workout not found"}}


def test_invoke_external_unwraps_json_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.mcp.external_tools.require_mcp_user", lambda: MagicMock())

    def created(**kwargs):
        return JSONResponse(status_code=201, content={"created": True})

    assert external_tools.invoke_external(created) == {"created": True}


def test_invoke_external_maps_204_to_empty_dict(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.mcp.external_tools.require_mcp_user", lambda: MagicMock())

    def deleted(**kwargs):
        return None

    assert external_tools.invoke_external(deleted) == {}


def test_hevy_not_configured_returns_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.mcp.external_tools.require_mcp_user", lambda: MagicMock())
    monkeypatch.setattr("backend.mcp.external_tools._hevy_client", lambda: None)
    result = external_tools.list_hevy_routines()
    assert result == {"error": {"code": "unavailable", "message": "Hevy not configured"}}


@pytest.mark.parametrize(
    "tool,kwargs,route_name,route_kwargs,return_value",
    [
        (external_tools.list_foods, {"q": "egg"}, "get_foods", {"q": "egg"}, [{"id": "f1"}]),
        (external_tools.list_meals, {"q": "lunch"}, "get_meals", {"q": "lunch"}, [{"id": "m1"}]),
        (external_tools.get_today, {"date": "2026-01-01"}, "get_today", {"date": "2026-01-01"}, {"date": "2026-01-01"}),
        (external_tools.get_week, {}, "get_week", {"date": None}, {"week": []}),
        (external_tools.get_month, {"year": 2026, "month": 1}, "get_month", {"year": 2026, "month": 1}, {"month": 1}),
        (
            external_tools.get_health,
            {"from_date": "2026-01-01", "to": "2026-01-07"},
            "get_health_range",
            {"from_": "2026-01-01", "to": "2026-01-07"},
            {"days": []},
        ),
        (external_tools.get_weight, {}, "get_weight", {"date": None}, {"weightKg": 80}),
        (external_tools.get_day_status, {}, "get_day_status", {"date": None}, {"notTracked": False}),
        (external_tools.list_health_snapshots, {"limit": 4}, "get_health_snapshots", {"limit": 4}, []),
        (
            external_tools.list_hevy_workouts,
            {"limit": 10},
            "get_hevy_workouts",
            {"from_": None, "to": None, "limit": 10},
            [],
        ),
        (
            external_tools.get_hevy_workout,
            {"workout_id": "w1"},
            "get_hevy_workout_detail",
            {"workout_id": "w1"},
            {"id": "w1"},
        ),
        (
            external_tools.list_hevy_exercises,
            {"search": "squat"},
            "get_hevy_exercises",
            {"muscle_group": None, "equipment": None, "type": None, "search": "squat"},
            [],
        ),
        (external_tools.get_hevy_metadata, {}, "get_hevy_metadata", {}, {"muscleGroups": []}),
        (
            external_tools.get_hevy_exercise_progression,
            {"template_id": "t1"},
            "get_hevy_exercise_progression",
            {"template_id": "t1", "from_": None, "to": None},
            [],
        ),
        (external_tools.list_hevy_prs, {}, "get_hevy_prs", {}, []),
        (external_tools.get_hevy_habits, {}, "get_hevy_habits", {"from_": None, "to": None}, {}),
        (external_tools.list_hevy_routines, {}, "get_hevy_routines", {}, []),
        (
            external_tools.get_hevy_body_measurement,
            {"date": "2026-01-01"},
            "get_hevy_body_measurement",
            {"date": "2026-01-01"},
            {},
        ),
        (
            external_tools.create_meal,
            {
                "name": "Meal",
                "calories": 1,
                "protein": 1,
                "carbs": 1,
                "fat": 1,
            },
            "post_meal",
            {},
            {"id": "meal-1"},
        ),
        (
            external_tools.update_meal,
            {"meal_id": "meal-1", "fields": {"name": "Renamed"}},
            "patch_meal",
            {"meal_id": "meal-1"},
            {"id": "meal-1"},
        ),
        (external_tools.delete_meal, {"meal_id": "meal-1"}, "remove_meal", {"meal_id": "meal-1"}, {}),
        (
            external_tools.log_meal,
            {"meal_id": "meal-1", "servings": 1, "slot": "lunch"},
            "post_log_meal",
            {},
            {"id": "entry-1"},
        ),
        (
            external_tools.create_food,
            {"name": "Food", "calories": 1, "protein": 1, "carbs": 1, "fat": 1},
            "post_food",
            {},
            {"id": "food-1"},
        ),
        (
            external_tools.update_food,
            {"food_id": "food-1", "fields": {"name": "Renamed"}},
            "patch_food",
            {"food_id": "food-1"},
            {},
        ),
        (external_tools.delete_food, {"food_id": "food-1"}, "remove_food", {"food_id": "food-1", "confirm": False}, {}),
        (
            external_tools.quick_log,
            {"name": "Snack", "slot": "snack", "calories": 1, "protein": 0, "carbs": 0, "fat": 0},
            "post_quick_log",
            {},
            {"id": "entry-2"},
        ),
        (
            external_tools.log_food,
            {"food_id": "food-1", "servings": 1, "slot": "dinner"},
            "post_log_food",
            {},
            {"id": "entry-3"},
        ),
        (external_tools.delete_entry, {"entry_id": "entry-1"}, "remove_entry", {"entry_id": "entry-1"}, {}),
        (
            external_tools.put_weight,
            {"weight_kg": 81.5},
            "put_weight",
            {},
            {"weightKg": 81.5},
        ),
        (
            external_tools.put_day_status,
            {"not_tracked": True},
            "put_day_status",
            {},
            {"notTracked": True},
        ),
        (
            external_tools.create_hevy_routine,
            {"fields": {"routine": {"title": "Leg day", "exercises": []}}},
            "post_hevy_routine",
            {},
            {"id": "routine-1"},
        ),
        (
            external_tools.update_hevy_routine,
            {"routine_id": "routine-1", "fields": {"routine": {"title": "Updated", "exercises": []}}},
            "put_hevy_routine",
            {"routine_id": "routine-1"},
            {"id": "routine-1"},
        ),
        (
            external_tools.create_hevy_routine_folder,
            {"fields": {"routine_folder": {"title": "Strength"}}},
            "post_hevy_routine_folder",
            {},
            {"id": "folder-1"},
        ),
        (
            external_tools.put_hevy_body_measurement,
            {"date": "2026-01-01", "fields": {"weight_kg": 80}},
            "put_hevy_body_measurement",
            {"date": "2026-01-01"},
            {"weightKg": 80},
        ),
        (
            external_tools.link_hevy_garmin,
            {"workout_id": "w1", "garmin_activity_id": "g1"},
            "post_hevy_link",
            {},
            {"linked": True},
        ),
        (
            external_tools.unlink_hevy_garmin,
            {"workout_id": "w1", "garmin_activity_id": "g1"},
            "delete_hevy_link",
            {},
            {"unlinked": True},
        ),
        (external_tools.load_hevy_templates, {}, "post_hevy_load_templates", {}, {"count": 1}),
        (external_tools.load_hevy_workouts, {}, "post_hevy_load_workouts", {}, {"count": 2}),
        (external_tools.load_hevy_events, {}, "post_hevy_load_events", {}, {"count": 3}),
    ],
)
def test_tools_delegate_to_external_routes(
    monkeypatch: pytest.MonkeyPatch,
    tool,
    kwargs,
    route_name,
    route_kwargs,
    return_value,
) -> None:
    seen: dict = {}

    def route_stub(**call_kwargs):
        seen.update(call_kwargs)
        if return_value is None:
            return None
        return return_value

    monkeypatch.setattr("backend.mcp.external_tools.require_mcp_user", lambda: MagicMock())
    if route_name in {
        "get_hevy_routines",
        "post_hevy_routine",
        "put_hevy_routine",
        "post_hevy_routine_folder",
        "get_hevy_body_measurement",
        "put_hevy_body_measurement",
        "post_hevy_load_templates",
        "post_hevy_load_workouts",
        "post_hevy_load_events",
    }:
        monkeypatch.setattr("backend.mcp.external_tools._hevy_client", lambda: object())

    monkeypatch.setattr(external_routes, route_name, route_stub)
    result = tool(**kwargs)
    assert result == return_value
    assert "db" in seen
    assert "user" in seen
    for key, value in route_kwargs.items():
        if key == "payload":
            continue
        assert seen.get(key) == value