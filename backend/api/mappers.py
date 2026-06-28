from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..crypto import decrypt_api_key, mask_api_key
from ..db_models import AppSettingsRow, CheckInRow, DailyGoalRow, LogEntryRow, SavedFoodRow, SavedMealItemRow, SavedMealRow
from ..gcs import GCSService
from .compose import MacroTotals, food_to_macros, scale_macros
from .photo_storage import resolve_image_url_for_response
from .schemas import AiSettings, CheckIn, CheckInPhoto, DailyGoal, LogEntry, SavedFood, SavedMeal, SavedMealItem

DEFAULT_DAILY_GOAL = {"calories": 2200, "protein": 180, "carbs": 220, "fat": 70}


def get_daily_goal(db: Session, user_id: str) -> DailyGoalRow | None:
    return db.query(DailyGoalRow).filter(DailyGoalRow.user_id == user_id).first()


def get_or_create_daily_goal(db: Session, user_id: str) -> DailyGoalRow:
    row = get_daily_goal(db, user_id)
    if row is not None:
        return row

    row = DailyGoalRow(user_id=user_id, **DEFAULT_DAILY_GOAL)
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError:
        db.rollback()
        row = get_daily_goal(db, user_id)
        if row is None:
            raise
        return row


def get_app_settings(db: Session, user_id: str) -> AppSettingsRow | None:
    return db.query(AppSettingsRow).filter(AppSettingsRow.user_id == user_id).first()


def get_or_create_app_settings(db: Session, user_id: str) -> AppSettingsRow:
    row = get_app_settings(db, user_id)
    if row is not None:
        return row

    row = AppSettingsRow(user_id=user_id, text_model="gpt-5-nano", image_model="gpt-5-mini")
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError:
        db.rollback()
        row = get_app_settings(db, user_id)
        if row is None:
            raise
        return row


def daily_goal_to_schema(row: DailyGoalRow) -> DailyGoal:
    return DailyGoal(
        calories=row.calories,
        protein=row.protein,
        carbs=row.carbs,
        fat=row.fat,
    )


def saved_food_to_schema(row: SavedFoodRow) -> SavedFood:
    tags = row.tags if isinstance(row.tags, list) else []
    return SavedFood(
        id=row.id,
        name=row.name,
        description=row.description,
        calories=row.calories,
        protein=row.protein,
        carbs=row.carbs,
        fat=row.fat,
        tags=tags,
    )


def saved_meal_item_to_schema(item: SavedMealItemRow) -> SavedMealItem:
    food = item.food
    food_name = food.name if food is not None else ""
    if food is not None:
        scaled = scale_macros(food_to_macros(food), item.quantity)
    else:
        scaled = MacroTotals(calories=0, protein=0, carbs=0, fat=0)

    return SavedMealItem(
        foodId=item.food_id,
        quantity=item.quantity,
        sortOrder=item.sort_order,
        foodName=food_name,
        calories=scaled.calories,
        protein=scaled.protein,
        carbs=scaled.carbs,
        fat=scaled.fat,
    )


def saved_meal_to_schema(row: SavedMealRow, gcs: GCSService) -> SavedMeal:
    items = [saved_meal_item_to_schema(item) for item in row.items]
    return SavedMeal(
        id=row.id,
        name=row.name,
        description=row.description,
        imageUrl=resolve_image_url_for_response(row.image_url, gcs),
        kind=row.kind,  # type: ignore[arg-type]
        calories=row.calories,
        protein=row.protein,
        carbs=row.carbs,
        fat=row.fat,
        items=items,
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
