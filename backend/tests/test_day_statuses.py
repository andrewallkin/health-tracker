from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from backend.tests.conftest import register_user


def test_mark_and_get_by_date(client: TestClient, auth_headers: dict[str, str]) -> None:
    today = date.today().isoformat()

    missing = client.get("/api/day-statuses", headers=auth_headers, params={"date": today})
    assert missing.status_code == 200
    assert missing.json() is None

    marked = client.put(
        "/api/day-statuses",
        headers=auth_headers,
        json={"statusDate": today},
    )
    assert marked.status_code == 200
    body = marked.json()
    assert body["statusDate"] == today
    assert "id" in body

    fetched = client.get("/api/day-statuses", headers=auth_headers, params={"date": today})
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]


def test_mark_is_idempotent(client: TestClient, auth_headers: dict[str, str]) -> None:
    today = date.today().isoformat()
    first = client.put(
        "/api/day-statuses",
        headers=auth_headers,
        json={"statusDate": today},
    )
    second = client.put(
        "/api/day-statuses",
        headers=auth_headers,
        json={"statusDate": today},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]


def test_get_range(client: TestClient, auth_headers: dict[str, str]) -> None:
    today = date.today()
    d1 = (today - timedelta(days=2)).isoformat()
    d2 = today.isoformat()

    client.put("/api/day-statuses", headers=auth_headers, json={"statusDate": d1})
    client.put("/api/day-statuses", headers=auth_headers, json={"statusDate": d2})

    ranged = client.get(
        "/api/day-statuses",
        headers=auth_headers,
        params={"from": d1, "to": d2},
    )
    assert ranged.status_code == 200
    dates = {row["statusDate"] for row in ranged.json()}
    assert dates == {d1, d2}


def test_unmark_deletes_row(client: TestClient, auth_headers: dict[str, str]) -> None:
    today = date.today().isoformat()
    created = client.put(
        "/api/day-statuses",
        headers=auth_headers,
        json={"statusDate": today},
    )
    status_id = created.json()["id"]

    deleted = client.delete(f"/api/day-statuses/{status_id}", headers=auth_headers)
    assert deleted.status_code == 204

    fetched = client.get("/api/day-statuses", headers=auth_headers, params={"date": today})
    assert fetched.json() is None


def test_reject_future_date(client: TestClient, auth_headers: dict[str, str]) -> None:
    future = (date.today() + timedelta(days=1)).isoformat()
    response = client.put(
        "/api/day-statuses",
        headers=auth_headers,
        json={"statusDate": future},
    )
    assert response.status_code == 400


def test_day_status_isolated_between_users(client: TestClient) -> None:
    headers_a = register_user(client, "day-a@example.com")
    headers_b = register_user(client, "day-b@example.com")
    today = date.today().isoformat()

    created = client.put(
        "/api/day-statuses",
        headers=headers_a,
        json={"statusDate": today},
    )
    status_id = created.json()["id"]

    forbidden = client.delete(f"/api/day-statuses/{status_id}", headers=headers_b)
    assert forbidden.status_code == 404

    other = client.get("/api/day-statuses", headers=headers_b, params={"date": today})
    assert other.json() is None
