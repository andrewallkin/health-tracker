"""Hevy webhook receiver: accept workout events and sync off the request path.

Auth is the shared webhook token (``HEVY_WEBHOOK_TOKEN``) — not the external
API key. The contract is a sub-5-second 200: the handler validates the token
and body, spawns the sync on a daemon thread, and returns immediately —
zero Hevy calls on the request path. The background worker is a module-level
function (``run_webhook_sync``) so tests can monkeypatch it and run it inline.
"""

from __future__ import annotations

import hmac
import logging
import threading

from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import SessionLocal
from ..hevy_client import hevy_client_from_settings
from ..hevy_sync import sync_workout
from . import hevy_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hevy", tags=["hevy"])


def _authorized(header_value: str | None, token: str) -> bool:
    """Accept ``Bearer <token>`` or the raw token (Hevy may omit the prefix)."""
    candidate = header_value.strip() if header_value else ""
    return hmac.compare_digest(candidate, f"Bearer {token}") or hmac.compare_digest(
        candidate, token
    )


def run_webhook_sync(workout_id: str) -> None:
    """Background worker: fetch the workout from Hevy, upsert it, link Garmin.

    Skips silently when Hevy is unconfigured or no user is resolvable. A sync
    failure is logged, never raised — the webhook has already answered 200.
    """
    client = hevy_client_from_settings(get_settings())
    if client is None:
        return
    db: Session = SessionLocal()
    try:
        user_id = hevy_service.configured_hevy_user_id(db)
        if user_id is None:
            return
        try:
            sync_workout(db, user_id, client, workout_id)
        except Exception:  # noqa: BLE001 — the webhook already answered 200
            logger.exception("Hevy webhook sync failed for workout %s", workout_id)
    finally:
        db.close()


def _spawn_sync(workout_id: str) -> threading.Thread:
    """Run the (injectable) background sync on a daemon thread."""
    thread = threading.Thread(
        target=run_webhook_sync, args=(workout_id,), name="hevy-webhook-sync", daemon=True
    )
    thread.start()
    return thread


@router.post("/webhook")
async def post_hevy_webhook(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    settings = get_settings()
    token = settings.hevy_webhook_token
    if not token:
        raise HTTPException(status_code=503, detail="Hevy webhook not configured")
    if not _authorized(authorization, token):
        raise HTTPException(status_code=401, detail="Invalid or missing webhook token")

    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="Malformed body") from None
    workout_id = payload.get("workoutId") if isinstance(payload, dict) else None
    if not isinstance(workout_id, str) or not workout_id.strip():
        raise HTTPException(status_code=400, detail="Malformed body")

    _spawn_sync(workout_id)
    return {"status": "accepted"}
