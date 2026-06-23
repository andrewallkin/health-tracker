from __future__ import annotations

from sqlalchemy.orm import Session

from ..crypto import decrypt_api_key, mask_api_key
from ..db_models import AppSettingsRow, DailyGoalRow, LogEntryRow, SavedMealRow
from .schemas import AiSettings, DailyGoal, LogEntry, SavedMeal


def get_or_create_daily_goal(db: Session) -> DailyGoalRow:
    row = db.get(DailyGoalRow, 1)
    if row is None:
        row = DailyGoalRow(id=1, calories=2200, protein=180, carbs=220, fat=70)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_or_create_app_settings(db: Session) -> AppSettingsRow:
    row = db.get(AppSettingsRow, 1)
    if row is None:
        row = AppSettingsRow(id=1, text_model="gpt-5-nano", image_model="gpt-5-mini")
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


def saved_meal_to_schema(row: SavedMealRow) -> SavedMeal:
    return SavedMeal(
        id=row.id,
        name=row.name,
        description=row.description,
        imageUrl=row.image_url,
        calories=row.calories,
        protein=row.protein,
        carbs=row.carbs,
        fat=row.fat,
    )


def log_entry_to_schema(row: LogEntryRow) -> LogEntry:
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
        imageUrl=image_url,
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
