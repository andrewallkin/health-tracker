from __future__ import annotations

from datetime import timedelta

import pytest

from backend.auth import create_token, decode_token, get_password_hash, verify_password


def test_password_hash_and_verify() -> None:
    hashed = get_password_hash("password123")
    assert hashed != "password123"
    assert verify_password("password123", hashed)
    assert not verify_password("wrong-password", hashed)


def test_create_and_decode_access_token() -> None:
    token, jti = create_token("user-abc", timedelta(minutes=30))
    payload = decode_token(token)
    assert payload["sub"] == "user-abc"
    assert payload["jti"] == str(jti)
    assert payload["exp"] > payload["iat"]


def test_decode_invalid_token_raises() -> None:
    with pytest.raises(ValueError, match="Invalid token"):
        decode_token("not-a-valid-jwt")
