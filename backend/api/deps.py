from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import decode_token
from ..crypto import decrypt_api_key
from ..database import get_db
from ..db_models import AppSettingsRow, UserRow
from ..food_classifier import MacrosEstimator
from .mappers import get_or_create_app_settings


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> UserRow:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing credentials",
        )
    token = authorization.replace("Bearer ", "", 1)
    try:
        payload = decode_token(token)
        user_id = payload["sub"]
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Could not validate credentials") from exc

    user = db.query(UserRow).filter(UserRow.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    return user


def get_macros_estimator(
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> MacrosEstimator:
    settings = get_or_create_app_settings(db, user.id)
    if not settings.openai_api_key_encrypted:
        raise HTTPException(
            status_code=422,
            detail="Add your OpenAI API key in Settings before estimating food.",
        )
    try:
        api_key = decrypt_api_key(settings.openai_api_key_encrypted)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Could not decrypt stored API key. Check SETTINGS_ENCRYPTION_KEY.",
        ) from exc

    return MacrosEstimator(
        api_key=api_key,
        text_model=settings.text_model,
        image_model=settings.image_model,
        load_env=False,
    )
