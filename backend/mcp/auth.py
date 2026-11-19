from __future__ import annotations

from fastmcp.server.auth import TokenVerifier
from fastmcp.server.dependencies import get_http_headers
from mcp.server.auth.provider import AccessToken
from sqlalchemy.orm import Session

from ..api.external_auth import EXTERNAL_API_KEY_PREFIX, EXTERNAL_API_KEY_LOOKUP_LEN
from ..auth import verify_password
from ..database import SessionLocal
from ..db_models import UserRow
from ..mcp.oauth_provider import SCOPE
from ..mcp.oauth_store import SqlOAuthRepository
from ..mcp.token_hash import hash_oauth_token

oauth_grants = SqlOAuthRepository()


class McpAuthError(Exception):
    pass


def _user_from_external_api_key(db: Session, token: str) -> UserRow | None:
    if not token.startswith(EXTERNAL_API_KEY_PREFIX) or len(token) < 20:
        return None
    user = (
        db.query(UserRow)
        .filter(
            UserRow.external_api_key_prefix == token[:EXTERNAL_API_KEY_LOOKUP_LEN],
            UserRow.external_api_key_hash.isnot(None),
        )
        .first()
    )
    if user is None or not user.is_active or not verify_password(token, user.external_api_key_hash or ""):
        return None
    return user


class McpApiKeyVerifier(TokenVerifier):
    """Accept per-user external API keys (ht_...) as bearer tokens alongside OAuth access tokens."""

    def __init__(self, base_url: str) -> None:
        super().__init__(base_url=base_url, required_scopes=[SCOPE])

    async def verify_token(self, token: str) -> AccessToken | None:
        with SessionLocal() as db:
            user = _user_from_external_api_key(db, token)
        if user is None:
            return None
        return AccessToken(token=token, client_id="external-api-key", scopes=[SCOPE])


def extract_bearer_token(headers: dict[str, str]) -> str:
    authorization = headers.get("authorization") or headers.get("Authorization") or ""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise McpAuthError("Missing Authorization bearer token")
    return token.strip()


def require_mcp_user() -> UserRow:
    token = extract_bearer_token(dict(get_http_headers(include={"authorization"})))
    with SessionLocal() as db:
        user = _user_from_external_api_key(db, token)
        if user is not None:
            return user
        user_id = oauth_grants.user_id_for_access_token(token)
        if user_id is None:
            raise McpAuthError("Invalid or missing API key")
        user = db.get(UserRow, user_id)
        if user is None or not user.is_active:
            raise McpAuthError("Invalid or missing API key")
        return user