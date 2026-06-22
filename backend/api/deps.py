from __future__ import annotations

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from ..crypto import decrypt_api_key
from ..database import get_db
from ..db_models import AppSettingsRow
from ..food_classifier import MacrosEstimator
from .mappers import get_or_create_app_settings


def get_macros_estimator(db: Session = Depends(get_db)) -> MacrosEstimator:
    settings = get_or_create_app_settings(db)
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
