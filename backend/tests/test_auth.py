from __future__ import annotations


def test_register_login_and_me(client):
    register_response = client.post(
        "/api/auth/register",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert register_response.status_code == 201
    register_data = register_response.json()
    assert register_data["access_token"]
    assert register_data["user"]["email"] == "user@example.com"

    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["access_token"]

    me_response = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "user@example.com"


def test_register_rejects_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "password123"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    duplicate = client.post("/api/auth/register", json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Email already taken"


def test_register_rejects_invalid_email(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "password": "password123"},
    )
    assert response.status_code == 422


def test_login_rejects_invalid_credentials(client):
    client.post(
        "/api/auth/register",
        json={"email": "valid@example.com", "password": "password123"},
    )
    response = client.post(
        "/api/auth/login",
        json={"email": "valid@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_refresh_and_logout(client):
    register_response = client.post(
        "/api/auth/register",
        json={"email": "session@example.com", "password": "password123"},
    )
    assert register_response.status_code == 201
    refresh_cookie = register_response.cookies.get("refresh_token")
    assert refresh_cookie

    refresh_response = client.post("/api/auth/refresh")
    assert refresh_response.status_code == 200
    assert refresh_response.json()["access_token"]

    access_token = register_response.json()["access_token"]
    logout_response = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert logout_response.status_code == 204

    stale_refresh = client.post("/api/auth/refresh")
    assert stale_refresh.status_code == 401
