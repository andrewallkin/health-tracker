from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock

from backend.crypto import decrypt_api_key, encrypt_api_key
from backend.database import get_db
from backend.db_models import AppSettingsRow


FAKE_TOKENS = '{"access":"old"}'


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


def connect_garmin(client, auth_headers) -> AppSettingsRow:
    response = client.get("/api/settings/garmin", headers=auth_headers)
    assert response.status_code == 200
    gen = client.app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        row = db.query(AppSettingsRow).one()
        row.garmin_email = "garmin@example.com"
        row.garmin_tokens_encrypted = encrypt_api_key(FAKE_TOKENS)
        db.commit()
        db.refresh(row)
        db.expunge(row)
        return row
    finally:
        db.close()
        try:
            next(gen)
        except StopIteration:
            pass


def test_health_routes_require_auth(client) -> None:
    assert client.get(
        "/api/health/day", params={"date": "2026-07-17", "timezone": "UTC"}
    ).status_code == 401
    assert client.get(
        "/api/health/week", params={"start": "2026-07-13", "timezone": "UTC"}
    ).status_code == 401
    assert client.get(
        "/api/health/month",
        params={"year": 2026, "month": 7, "timezone": "UTC"},
    ).status_code == 401


def test_health_day_returns_connect_cta_when_garmin_disconnected(
    client, auth_headers
) -> None:
    response = client.get(
        "/api/health/day",
        params={"date": "2026-07-17", "timezone": "UTC"},
        headers=auth_headers,
    )

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Garmin is not connected. Connect Garmin in Settings."
    }


def test_health_day_resolves_requested_date(client, auth_headers, monkeypatch) -> None:
    connect_garmin(client, auth_headers)
    fetched: list[str] = []

    def fake_build_fetch_day(_settings_row):
        def fetch_day(date_str: str) -> dict:
            fetched.append(date_str)
            return health_payload(date_str)

        return fetch_day, lambda _db, _row: None

    monkeypatch.setattr(
        "backend.api.routes.health.build_fetch_day", fake_build_fetch_day
    )

    response = client.get(
        "/api/health/day",
        params={"date": date.today().isoformat(), "timezone": "UTC"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["day"]["date"] == date.today().isoformat()
    assert response.json()["errors"] == []
    assert fetched == [date.today().isoformat()]


def test_health_day_rejects_invalid_date_and_timezone(
    client, auth_headers, monkeypatch
) -> None:
    connect_garmin(client, auth_headers)
    monkeypatch.setattr(
        "backend.api.routes.health.build_fetch_day",
        lambda _row: (
            lambda date_str: health_payload(date_str),
            lambda _db, _row: None,
        ),
    )

    invalid_date = client.get(
        "/api/health/day",
        params={"date": "not-a-date", "timezone": "UTC"},
        headers=auth_headers,
    )
    invalid_timezone = client.get(
        "/api/health/day",
        params={"date": "2026-07-17", "timezone": "Mars/Olympus"},
        headers=auth_headers,
    )

    assert invalid_date.status_code == 400
    assert invalid_date.json()["detail"] == "Invalid date"
    assert invalid_timezone.status_code == 400
    assert invalid_timezone.json()["detail"] == "Invalid timezone"


def test_health_day_and_week_reject_non_iso_date_formats(
    client, auth_headers, monkeypatch
) -> None:
    connect_garmin(client, auth_headers)
    monkeypatch.setattr(
        "backend.api.routes.health.build_fetch_day",
        lambda _row: (
            lambda date_str: health_payload(date_str),
            lambda _db, _row: None,
        ),
    )

    for bad_date in ("20260717", "2026-W29-5"):
        day_response = client.get(
            "/api/health/day",
            params={"date": bad_date, "timezone": "UTC"},
            headers=auth_headers,
        )
        week_response = client.get(
            "/api/health/week",
            params={"start": bad_date, "timezone": "UTC"},
            headers=auth_headers,
        )

        assert day_response.status_code == 400
        assert day_response.json()["detail"] == "Invalid date"
        assert week_response.status_code == 400
        assert week_response.json()["detail"] == "Invalid start"


def test_health_week_returns_seven_days_and_per_day_errors(
    client, auth_headers, monkeypatch
) -> None:
    connect_garmin(client, auth_headers)
    requested: list[str] = []

    def fake_build_fetch_day(_settings_row):
        def fetch_day(date_str: str) -> dict:
            requested.append(date_str)
            if date_str == "2026-06-03":
                raise RuntimeError("Garmin unavailable")
            return health_payload(date_str)

        return fetch_day, lambda _db, _row: None

    monkeypatch.setattr(
        "backend.api.routes.health.build_fetch_day", fake_build_fetch_day
    )

    # Use a fully-past week so "today" is never included in requested dates.
    response = client.get(
        "/api/health/week",
        params={"start": "2026-06-01", "timezone": "UTC"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert sorted(requested) == [
        "2026-06-01",
        "2026-06-02",
        "2026-06-03",
        "2026-06-04",
        "2026-06-05",
        "2026-06-06",
        "2026-06-07",
    ]
    assert [day["date"] for day in response.json()["days"]] == [
        "2026-06-01",
        "2026-06-02",
        "2026-06-04",
        "2026-06-05",
        "2026-06-06",
        "2026-06-07",
    ]
    assert response.json()["errors"] == [
        {"date": "2026-06-03", "message": "Garmin unavailable"}
    ]


def test_health_month_uses_calendar_days_only(
    client, auth_headers, monkeypatch
) -> None:
    connect_garmin(client, auth_headers)
    requested: list[str] = []
    monkeypatch.setattr(
        "backend.api.routes.health.build_fetch_day",
        lambda _row: (
            lambda date_str: requested.append(date_str) or health_payload(date_str),
            lambda _db, _row: None,
        ),
    )

    response = client.get(
        "/api/health/month",
        params={"year": 2024, "month": 2, "timezone": "UTC"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert sorted(requested) == [f"2024-02-{day:02d}" for day in range(1, 30)]
    assert len(response.json()["days"]) == 29


def test_health_month_rejects_invalid_month(client, auth_headers) -> None:
    connect_garmin(client, auth_headers)

    response = client.get(
        "/api/health/month",
        params={"year": 2026, "month": 13, "timezone": "UTC"},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid month"


def test_health_month_rejects_invalid_year(client, auth_headers) -> None:
    connect_garmin(client, auth_headers)

    response = client.get(
        "/api/health/month",
        params={"year": 0, "month": 1, "timezone": "UTC"},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid year"


def test_build_fetch_day_refreshes_changed_tokens(
    client, auth_headers, monkeypatch
) -> None:
    row = connect_garmin(client, auth_headers)
    api = MagicMock()
    api.client.dumps.return_value = '{"access":"new"}'
    monkeypatch.setattr(
        "backend.api.routes.health.garmin_from_tokens",
        lambda tokens: api if tokens == FAKE_TOKENS else None,
    )
    monkeypatch.setattr(
        "backend.api.routes.health.fetch_and_normalize_day",
        lambda passed_api, date_str: health_payload(date_str)
        if passed_api is api
        else None,
    )

    gen = client.app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        from backend.api.routes.health import build_fetch_day

        persisted_row = db.query(AppSettingsRow).filter_by(id=row.id).one()
        fetch_day, persist_tokens = build_fetch_day(persisted_row)
        result = fetch_day("2026-07-17")
        assert decrypt_api_key(persisted_row.garmin_tokens_encrypted) == FAKE_TOKENS
        persist_tokens(db, persisted_row)
        db.refresh(persisted_row)
    finally:
        db.close()
        try:
            next(gen)
        except StopIteration:
            pass

    assert result == health_payload("2026-07-17")
    assert decrypt_api_key(persisted_row.garmin_tokens_encrypted) == '{"access":"new"}'
