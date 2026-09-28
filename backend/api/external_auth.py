from __future__ import annotations

import secrets

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_password_hash, verify_password
from ..database import get_db
from ..db_models import UserRow

EXTERNAL_API_KEY_PREFIX = "ht_"
EXTERNAL_API_KEY_LOOKUP_LEN = 12


def create_external_api_key_material() -> tuple[str, str, str]:
    """Return (full_key, lookup_prefix, bcrypt_hash) for a new external API key."""
    full_key = f"{EXTERNAL_API_KEY_PREFIX}{secrets.token_urlsafe(32)}"
    lookup_prefix = full_key[:EXTERNAL_API_KEY_LOOKUP_LEN]
    return full_key, lookup_prefix, get_password_hash(full_key)


def get_user_from_external_api_key(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> UserRow:
    """Authenticate machine clients via per-user keys (ht_...). JWTs are rejected."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API key",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not authorization or not authorization.startswith("Bearer "):
        raise credentials_exception
    token = authorization.removeprefix("Bearer ").strip()
    if not token.startswith(EXTERNAL_API_KEY_PREFIX) or len(token) < 20:
        raise credentials_exception

    user = (
        db.query(UserRow)
        .filter(
            UserRow.external_api_key_prefix == token[:EXTERNAL_API_KEY_LOOKUP_LEN],
            UserRow.external_api_key_hash.isnot(None),
        )
        .first()
    )
    if user is None or not user.is_active or not verify_password(token, user.external_api_key_hash or ""):
        raise credentials_exception
    return user
