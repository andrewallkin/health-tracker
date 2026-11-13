from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...crypto import encrypt_api_key
from ...database import get_db
from ...db_models import AppSettingsRow, UserRow, utcnow
from ...garmin_auth import GarminAuthError, login_and_dump_tokens
from ...openrouter_models import list_food_models
from ..deps import get_current_user
from ..external_auth import create_external_api_key_material
from ..mappers import app_settings_to_schema, get_or_create_app_settings
from ..schemas import (
    AiSettings,
    AiSettingsUpdate,
    GarminConnectRequest,
    GarminSettings,
    ModelsResponse,
)
from ..schemas_external import ExternalApiKeyCreated, ExternalApiKeyStatus

router = APIRouter(prefix="/settings", tags=["settings"])


def garmin_settings_from_row(row: AppSettingsRow) -> GarminSettings:
    connected = bool(row.garmin_tokens_encrypted and row.garmin_email)
    return GarminSettings(
        connected=connected,
        email=row.garmin_email if connected else None,
    )


@router.get("/models", response_model=ModelsResponse)
def list_models(_user: UserRow = Depends(get_current_user)) -> ModelsResponse:
    return ModelsResponse(models=list_food_models())


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


def _external_key_status(user: UserRow) -> ExternalApiKeyStatus:
    has_key = bool(user.external_api_key_hash)
    created = user.external_api_key_created_at
    return ExternalApiKeyStatus(
        hasKey=has_key,
        prefix=user.external_api_key_prefix if has_key else None,
        createdAt=created.isoformat() if has_key and created is not None else None,
    )


@router.get("/external-api-key", response_model=ExternalApiKeyStatus)
def get_external_api_key(
    user: UserRow = Depends(get_current_user),
) -> ExternalApiKeyStatus:
    return _external_key_status(user)


@router.post("/external-api-key", response_model=ExternalApiKeyCreated, status_code=201)
def generate_external_api_key(
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> ExternalApiKeyCreated:
    full_key, prefix, key_hash = create_external_api_key_material()
    user.external_api_key_hash = key_hash
    user.external_api_key_prefix = prefix
    user.external_api_key_created_at = utcnow()
    db.commit()
    db.refresh(user)
    created = user.external_api_key_created_at
    return ExternalApiKeyCreated(
        apiKey=full_key,
        prefix=prefix,
        createdAt=created.isoformat() if created is not None else "",
    )


@router.delete("/external-api-key", status_code=204)
def revoke_external_api_key(
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> None:
    user.external_api_key_hash = None
    user.external_api_key_prefix = None
    user.external_api_key_created_at = None
    db.commit()
