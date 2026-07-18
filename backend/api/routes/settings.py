from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...crypto import encrypt_api_key
from ...database import get_db
from ...db_models import AppSettingsRow, UserRow
from ...garmin_auth import GarminAuthError, login_and_dump_tokens
from ..deps import get_current_user
from ..mappers import app_settings_to_schema, get_or_create_app_settings
from ..schemas import (
    AiSettings,
    AiSettingsUpdate,
    GarminConnectRequest,
    GarminSettings,
    ModelOption,
    ModelsResponse,
)

router = APIRouter(prefix="/settings", tags=["settings"])

# Chat Completions models with strict JSON schema (Structured Outputs) support.
# Vision-capable models are listed for photo estimates; text-only picks omit vision.
MODEL_OPTIONS: list[ModelOption] = [
    ModelOption(
        id="gpt-5-nano",
        label="GPT-5 Nano",
        supportsVision=False,
        recommendedFor="text",
    ),
    ModelOption(id="gpt-5.4-nano", label="GPT-5.4 Nano", supportsVision=False),
    ModelOption(id="gpt-4.1-nano", label="GPT-4.1 Nano", supportsVision=False),
    ModelOption(id="gpt-4o-mini", label="GPT-4o Mini", supportsVision=False),
    ModelOption(id="gpt-5.4-mini", label="GPT-5.4 Mini", supportsVision=False),
    ModelOption(id="gpt-5-mini", label="GPT-5 Mini", supportsVision=False),
    ModelOption(id="gpt-4.1-mini", label="GPT-4.1 Mini", supportsVision=False),
    ModelOption(id="gpt-4.1", label="GPT-4.1", supportsVision=False),
    ModelOption(id="gpt-5.4", label="GPT-5.4", supportsVision=False),
    ModelOption(id="gpt-5.4-pro", label="GPT-5.4 Pro", supportsVision=False),
    ModelOption(id="gpt-5.2", label="GPT-5.2", supportsVision=False),
    ModelOption(id="gpt-5.2-pro", label="GPT-5.2 Pro", supportsVision=False),
    ModelOption(id="gpt-5.1", label="GPT-5.1", supportsVision=False),
    ModelOption(id="gpt-5", label="GPT-5", supportsVision=False),
    ModelOption(id="gpt-5-pro", label="GPT-5 Pro", supportsVision=False),
    ModelOption(id="gpt-5.5", label="GPT-5.5", supportsVision=False),
    ModelOption(id="gpt-5.5-pro", label="GPT-5.5 Pro", supportsVision=False),
    ModelOption(
        id="gpt-5-mini",
        label="GPT-5 Mini",
        supportsVision=True,
        recommendedFor="image",
    ),
    ModelOption(id="gpt-5-nano", label="GPT-5 Nano", supportsVision=True),
    ModelOption(id="gpt-5.4-nano", label="GPT-5.4 Nano", supportsVision=True),
    ModelOption(id="gpt-5.4-mini", label="GPT-5.4 Mini", supportsVision=True),
    ModelOption(id="gpt-4.1-nano", label="GPT-4.1 Nano", supportsVision=True),
    ModelOption(id="gpt-4o-mini", label="GPT-4o Mini", supportsVision=True),
    ModelOption(id="gpt-4.1-mini", label="GPT-4.1 Mini", supportsVision=True),
    ModelOption(id="gpt-4.1", label="GPT-4.1", supportsVision=True),
    ModelOption(id="gpt-4o", label="GPT-4o", supportsVision=True),
    ModelOption(id="gpt-5.4", label="GPT-5.4", supportsVision=True),
    ModelOption(id="gpt-5.4-pro", label="GPT-5.4 Pro", supportsVision=True),
    ModelOption(id="gpt-5.2", label="GPT-5.2", supportsVision=True),
    ModelOption(id="gpt-5.2-pro", label="GPT-5.2 Pro", supportsVision=True),
    ModelOption(id="gpt-5.1", label="GPT-5.1", supportsVision=True),
    ModelOption(id="gpt-5", label="GPT-5", supportsVision=True),
    ModelOption(id="gpt-5-pro", label="GPT-5 Pro", supportsVision=True),
    ModelOption(id="gpt-5.5", label="GPT-5.5", supportsVision=True),
    ModelOption(id="gpt-5.5-pro", label="GPT-5.5 Pro", supportsVision=True),
]


def garmin_settings_from_row(row: AppSettingsRow) -> GarminSettings:
    connected = bool(row.garmin_tokens_encrypted and row.garmin_email)
    return GarminSettings(
        connected=connected,
        email=row.garmin_email if connected else None,
    )


@router.get("/models", response_model=ModelsResponse)
def list_models(_user: UserRow = Depends(get_current_user)) -> ModelsResponse:
    return ModelsResponse(models=MODEL_OPTIONS)


@router.get("/ai", response_model=AiSettings)
def get_ai_settings(
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> AiSettings:
    return app_settings_to_schema(get_or_create_app_settings(db, user.id))


@router.put("/ai", response_model=AiSettings)
def update_ai_settings(
    payload: AiSettingsUpdate,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> AiSettings:
    row = get_or_create_app_settings(db, user.id)
    row.text_model = payload.textModel.strip()
    row.image_model = payload.imageModel.strip()
    if payload.clearApiKey:
        row.openai_api_key_encrypted = None
    elif payload.apiKey and payload.apiKey.strip():
        row.openai_api_key_encrypted = encrypt_api_key(payload.apiKey.strip())
    db.commit()
    db.refresh(row)
    return app_settings_to_schema(row)


@router.get("/garmin", response_model=GarminSettings)
def get_garmin_settings(
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> GarminSettings:
    return garmin_settings_from_row(get_or_create_app_settings(db, user.id))


@router.post("/garmin/connect", response_model=GarminSettings)
def connect_garmin(
    payload: GarminConnectRequest,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> GarminSettings:
    email = str(payload.email).strip().lower()
    password = payload.password
    try:
        tokens_json = login_and_dump_tokens(email, password)
    except GarminAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    row = get_or_create_app_settings(db, user.id)
    row.garmin_email = email
    row.garmin_tokens_encrypted = encrypt_api_key(tokens_json)
    db.commit()
    db.refresh(row)
    return garmin_settings_from_row(row)


@router.delete("/garmin", response_model=GarminSettings)
def disconnect_garmin(
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> GarminSettings:
    row = get_or_create_app_settings(db, user.id)
    row.garmin_email = None
    row.garmin_tokens_encrypted = None
    db.commit()
    db.refresh(row)
    return garmin_settings_from_row(row)
