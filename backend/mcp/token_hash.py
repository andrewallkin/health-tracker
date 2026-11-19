from __future__ import annotations

import hashlib
import hmac

from ..config import get_settings


def hash_oauth_token(raw_token: str) -> str:
    settings = get_settings()
    secret = settings.jwt_secret_key or "dev-mcp-oauth-secret"
    return hmac.new(secret.encode("utf-8"), raw_token.encode("utf-8"), hashlib.sha256).hexdigest()