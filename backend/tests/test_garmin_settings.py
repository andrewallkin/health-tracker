from __future__ import annotations

from unittest.mock import MagicMock, patch

from backend.crypto import decrypt_api_key
from backend.database import get_db
from backend.db_models import AppSettingsRow


FAKE_TOKENS_JSON = (
    '{"di_token":"fake-access","di_refresh_token":"fake-refresh",'
    '"di_client_id":"GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2"}'
)


def _settings_row(client):
    gen = client.app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        return db.query(AppSettingsRow).first()
    finally:
        db.close()
        try:
            next(gen)
        except StopIteration:
            pass


def test_get_garmin_settings_disconnected(client, auth_headers):
    response = client.get("/api/settings/garmin", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body == {"connected": False, "email": None}
    assert "token" not in body
    assert "password" not in body


def test_connect_garmin_success_persists_encrypted_tokens(client, auth_headers):
    mock_garmin = MagicMock()
    mock_garmin.login.return_value = (None, None)
    mock_garmin.client.dumps.return_value = FAKE_TOKENS_JSON

    with patch("backend.garmin_auth.Garmin", return_value=mock_garmin) as garmin_cls:
        response = client.post(
            "/api/settings/garmin/connect",
            headers=auth_headers,
            json={"email": "garmin@example.com", "password": "secret-pass"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["connected"] is True
    assert body["email"] == "garmin@example.com"
    assert "password" not in body
    assert "token" not in str(body).lower()

    garmin_cls.assert_called_once()
    kwargs = garmin_cls.call_args.kwargs
    assert kwargs["email"] == "garmin@example.com"
    assert kwargs["password"] == "secret-pass"
    assert kwargs["return_on_mfa"] is True
    mock_garmin.login.assert_called_once()

    row = _settings_row(client)
    assert row is not None
    assert row.garmin_email == "garmin@example.com"
    assert row.garmin_tokens_encrypted
    assert decrypt_api_key(row.garmin_tokens_encrypted) == FAKE_TOKENS_JSON
    assert "secret-pass" not in (row.garmin_tokens_encrypted or "")


def test_connect_garmin_bad_credentials(client, auth_headers):
    from garminconnect import GarminConnectAuthenticationError

    mock_garmin = MagicMock()
    mock_garmin.login.side_effect = GarminConnectAuthenticationError("bad creds")

    with patch("backend.garmin_auth.Garmin", return_value=mock_garmin):
        response = client.post(
            "/api/settings/garmin/connect",
            headers=auth_headers,
            json={"email": "garmin@example.com", "password": "wrong"},
        )

    assert response.status_code == 400
    assert "detail" in response.json()

    row = _settings_row(client)
    assert row is None or (
        row.garmin_email is None and row.garmin_tokens_encrypted is None
    )


def test_connect_garmin_mfa_required(client, auth_headers):
    mock_garmin = MagicMock()
    mock_garmin.login.return_value = ("needs_mfa", {"state": "pending"})

    with patch("backend.garmin_auth.Garmin", return_value=mock_garmin):
        response = client.post(
            "/api/settings/garmin/connect",
            headers=auth_headers,
            json={"email": "garmin@example.com", "password": "secret-pass"},
        )

    assert response.status_code == 400
    assert "mfa" in response.json()["detail"].lower()

    row = _settings_row(client)
    assert row is None or (
        row.garmin_email is None and row.garmin_tokens_encrypted is None
    )


def test_disconnect_garmin_clears_tokens(client, auth_headers):
    mock_garmin = MagicMock()
    mock_garmin.login.return_value = (None, None)
    mock_garmin.client.dumps.return_value = FAKE_TOKENS_JSON

    with patch("backend.garmin_auth.Garmin", return_value=mock_garmin):
        connect = client.post(
            "/api/settings/garmin/connect",
            headers=auth_headers,
            json={"email": "garmin@example.com", "password": "secret-pass"},
        )
    assert connect.status_code == 200

    disconnect = client.delete("/api/settings/garmin", headers=auth_headers)
    assert disconnect.status_code == 200
    assert disconnect.json() == {"connected": False, "email": None}

    row = _settings_row(client)
    assert row is not None
    assert row.garmin_email is None
    assert row.garmin_tokens_encrypted is None


def test_garmin_settings_requires_auth(client):
    assert client.get("/api/settings/garmin").status_code == 401
    assert (
        client.post(
            "/api/settings/garmin/connect",
            json={"email": "a@b.com", "password": "x"},
        ).status_code
        == 401
    )
    assert client.delete("/api/settings/garmin").status_code == 401
