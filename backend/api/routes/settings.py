from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...crypto import encrypt_api_key
from ...database import get_db
from ..mappers import app_settings_to_schema, get_or_create_app_settings
from ..schemas import AiSettings, AiSettingsUpdate, ModelOption, ModelsResponse

router = APIRouter(prefix="/settings", tags=["settings"])

MODEL_OPTIONS: list[ModelOption] = [
    ModelOption(id="gpt-5-nano", label="GPT-5 Nano (text)", supportsVision=False),
    ModelOption(id="gpt-5-mini", label="GPT-5 Mini (vision)", supportsVision=True),
    ModelOption(id="gpt-4o-mini", label="GPT-4o Mini (vision)", supportsVision=True),
    ModelOption(id="gpt-4o", label="GPT-4o (vision)", supportsVision=True),
]


@router.get("/models", response_model=ModelsResponse)
def list_models() -> ModelsResponse:
    return ModelsResponse(models=MODEL_OPTIONS)


@router.get("/ai", response_model=AiSettings)
def get_ai_settings(db: Session = Depends(get_db)) -> AiSettings:
    return app_settings_to_schema(get_or_create_app_settings(db))


@router.put("/ai", response_model=AiSettings)
def update_ai_settings(payload: AiSettingsUpdate, db: Session = Depends(get_db)) -> AiSettings:
    row = get_or_create_app_settings(db)
    row.text_model = payload.textModel.strip()
    row.image_model = payload.imageModel.strip()
    if payload.apiKey and payload.apiKey.strip():
        row.openai_api_key_encrypted = encrypt_api_key(payload.apiKey.strip())
    db.commit()
    db.refresh(row)
    return app_settings_to_schema(row)
