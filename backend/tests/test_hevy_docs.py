"""Tests for the Hevy section of the external API docs endpoint.

The served plain text (``backend/docs/external-api.md``) is the agent-facing
contract: every Hevy endpoint path shipped by the implementation must appear
in it, alongside the payload literals an agent cannot guess (``folder_id``
and ``rep_range``).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from backend.tests.conftest import register_user

HEVY_PATHS = [
    "GET /api/external/hevy/workouts",
    "GET /api/external/hevy/workouts/{workoutId}",
    "GET /api/external/hevy/exercises",
    "GET /api/external/hevy/metadata",
    "GET /api/external/hevy/exercises/{templateId}/progression",
    "GET /api/external/hevy/prs",
    "GET /api/external/hevy/habits",
    "GET /api/external/hevy/routines",
    "POST /api/external/hevy/routines",
    "PUT /api/external/hevy/routines/{routineId}",
    "POST /api/external/hevy/routine-folders",
    "PUT /api/external/hevy/body-measurements/{date}",
    "POST /api/external/hevy/links",
    "DELETE /api/external/hevy/links",
    "POST /api/external/hevy/load/templates",
    "POST /api/external/hevy/load/workouts",
    "POST /api/external/hevy/load/events",
    "POST /api/hevy/webhook",
]


def _external_headers(client: TestClient) -> dict[str, str]:
    headers = register_user(client, f"{uuid.uuid4()}@example.com")
    response = client.post("/api/settings/external-api-key", headers=headers)
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['apiKey']}"}


def test_docs_contain_every_hevy_path(client) -> None:
    auth = _external_headers(client)
    response = client.get("/api/external/docs", headers=auth)
    assert response.status_code == 200
    assert "text/markdown" in response.headers["content-type"]
    for path in HEVY_PATHS:
        assert path in response.text, f"missing from docs: {path}"
    assert "folder_id" in response.text
    assert "rep_range" in response.text
