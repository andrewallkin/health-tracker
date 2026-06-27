from __future__ import annotations

from sqlalchemy.orm import Session

from ..crypto import decrypt_api_key, mask_api_key
from ..db_models import AppSettingsRow, CheckInRow, DailyGoalRow, LogEntryRow, SavedMealRow
from ..gcs import GCSService
from .photo_storage import resolve_image_url_for_response
from .schemas import AiSettings, CheckIn, CheckInPhoto, DailyGoal, LogEntry, SavedMeal


def get_or_create_daily_goal(db: Session, user_id: str) -> DailyGoalRow:
    row = db.query(DailyGoalRow).filter(DailyGoalRow.user_id == user_id).first()
    if row is None:
        row = DailyGoalRow(user_id=user_id, calories=2200, protein=180, carbs=220, fat=70)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_or_create_app_settings(db: Session, user_id: str) -> AppSettingsRow:
    row = db.query(AppSettingsRow).filter(AppSettingsRow.user_id == user_id).first()
    if row is None:
        row = AppSettingsRow(user_id=user_id, text_model="gpt-5-nano", image_model="gpt-5-mini")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def daily_goal_to_schema(row: DailyGoalRow) -> DailyGoal:
    return DailyGoal(
        calories=row.calories,
        protein=row.protein,
        carbs=row.carbs,
        fat=row.fat,
    )


def saved_meal_to_schema(row: SavedMealRow, gcs: GCSService) -> SavedMeal:
    return SavedMeal(
        id=row.id,
        name=row.name,
        description=row.description,
        imageUrl=resolve_image_url_for_response(row.image_url, gcs),
        calories=row.calories,
        protein=row.protein,
        carbs=row.carbs,
        fat=row.fat,
    )


def log_entry_to_schema(row: LogEntryRow, gcs: GCSService) -> LogEntry:
    image_url = row.image_url
    if not image_url and row.saved_meal is not None:
        image_url = row.saved_meal.image_url

    return LogEntry(
        id=row.id,
        logDate=row.log_date,
        name=row.name,
        slot=row.slot,  # type: ignore[arg-type]
        time=row.time,
        servings=row.servings,
        calories=row.calories,
        protein=row.protein,
        carbs=row.carbs,
        fat=row.fat,
        savedMealId=row.saved_meal_id,
        imageUrl=resolve_image_url_for_response(image_url, gcs),
    )


def app_settings_to_schema(row: AppSettingsRow) -> AiSettings:
    has_key = bool(row.openai_api_key_encrypted)
    hint = None
    if has_key and row.openai_api_key_encrypted:
        try:
            hint = mask_api_key(decrypt_api_key(row.openai_api_key_encrypted))
        except Exception:
            hint = "••••••••"
    return AiSettings(
        hasApiKey=has_key,
        apiKeyHint=hint,
        textModel=row.text_model,
        imageModel=row.image_model,
    )


def check_in_to_schema(row: CheckInRow, gcs: GCSService) -> CheckIn:
    return CheckIn(
        id=row.id,
        checkInDate=row.check_in_date,
        recordedAt=row.recorded_at.isoformat() + "Z",
        weightKg=row.weight_kg,
        notes=row.notes,
        photos=[
            CheckInPhoto(
                id=photo.id,
                imageUrl=resolve_image_url_for_response(photo.image_url, gcs) or photo.image_url,
                imagePath=photo.image_url,
                sortOrder=photo.sort_order,
            )
            for photo in row.photos
        ],
    )
