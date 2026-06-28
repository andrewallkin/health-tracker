from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ...database import get_db
from ...db_models import LogEntryRow, SavedMealItemRow, SavedMealRow, UserRow
from ...gcs import GCSService, get_gcs_service
from ..compose import sum_components
from ..deps import get_current_user
from ..mappers import saved_meal_to_schema
from ..ownership import get_owned_food, get_owned_meal
from ..schemas import SavedMeal, SavedMealCreate, SavedMealItemInput, SavedMealUpdate

router = APIRouter(prefix="/meals", tags=["meals"])


def _load_meals_query(db: Session, user_id: str):
    return (
        db.query(SavedMealRow)
        .options(joinedload(SavedMealRow.items).joinedload(SavedMealItemRow.food))
        .filter(SavedMealRow.user_id == user_id)
        .order_by(SavedMealRow.name)
    )


def _apply_composed_items(
    db: Session,
    user_id: str,
    meal: SavedMealRow,
    items: list[SavedMealItemInput],
) -> None:
    for item in list(meal.items):
        db.delete(item)
    meal.items.clear()

    components: list[tuple] = []
    for index, item_input in enumerate(items):
        food = get_owned_food(db, user_id, item_input.foodId)
        if food is None:
            raise HTTPException(status_code=404, detail=f"Food not found: {item_input.foodId}")

        sort_order = item_input.sortOrder if item_input.sortOrder else index
        row = SavedMealItemRow(
            id=str(uuid.uuid4()),
            meal_id=meal.id,
            food_id=food.id,
            quantity=item_input.quantity,
            sort_order=sort_order,
        )
        row.food = food
        db.add(row)
        meal.items.append(row)
        components.append((food, item_input.quantity))

    totals = sum_components(components)
    meal.kind = "composed"
    meal.calories = totals.calories
    meal.protein = totals.protein
    meal.carbs = totals.carbs
    meal.fat = totals.fat


@router.get("", response_model=list[SavedMeal])
def list_meals(
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> list[SavedMeal]:
    rows = _load_meals_query(db, user.id).all()
    return [saved_meal_to_schema(row, gcs) for row in rows]


@router.post("", response_model=SavedMeal, status_code=201)
def create_meal(
    payload: SavedMealCreate,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> SavedMeal:
    row = SavedMealRow(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=payload.name.strip(),
        description=payload.description,
        image_url=payload.imageUrl,
        kind="manual",
        calories=payload.calories or 0,
        protein=payload.protein or 0,
        carbs=payload.carbs or 0,
        fat=payload.fat or 0,
    )

    if payload.items is not None:
        db.add(row)
        db.flush()
        _apply_composed_items(db, user.id, row, payload.items)
    else:
        row.kind = "manual"
        db.add(row)

    db.commit()
    db.refresh(row)
    row = _load_meals_query(db, user.id).filter(SavedMealRow.id == row.id).one()
    return saved_meal_to_schema(row, gcs)


@router.patch("/{meal_id}", response_model=SavedMeal)
def update_meal(
    meal_id: str,
    payload: SavedMealUpdate,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> SavedMeal:
    row = (
        _load_meals_query(db, user.id)
        .filter(SavedMealRow.id == meal_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Meal not found")

    updates = payload.model_dump(exclude_unset=True)

    if "items" in updates:
        items = updates.pop("items")
        if items is None or len(items) == 0:
            raise HTTPException(status_code=422, detail="items must be non-empty for composed meals")
        item_inputs = [SavedMealItemInput.model_validate(item) for item in items]
        _apply_composed_items(db, user.id, row, item_inputs)
    elif row.kind == "composed":
        macro_fields = {"calories", "protein", "carbs", "fat"}
        if macro_fields.intersection(updates.keys()):
            raise HTTPException(
                status_code=422,
                detail="Cannot set macros directly on composed meals; update items instead",
            )

    field_map = {
        "name": "name",
        "description": "description",
        "imageUrl": "image_url",
        "calories": "calories",
        "protein": "protein",
        "carbs": "carbs",
        "fat": "fat",
    }
    for api_field, orm_field in field_map.items():
        if api_field in updates:
            if row.kind == "composed" and api_field in {"calories", "protein", "carbs", "fat"}:
                continue
            value = updates[api_field]
            if api_field == "name" and isinstance(value, str):
                value = value.strip()
            setattr(row, orm_field, value)

    db.commit()
    row = _load_meals_query(db, user.id).filter(SavedMealRow.id == meal_id).one()
    return saved_meal_to_schema(row, gcs)


@router.delete("/{meal_id}", status_code=204)
def delete_meal(
    meal_id: str,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> None:
    row = get_owned_meal(db, user.id, meal_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.query(LogEntryRow).filter(
        LogEntryRow.user_id == user.id,
        LogEntryRow.saved_meal_id == meal_id,
    ).update(
        {LogEntryRow.saved_meal_id: None},
        synchronize_session=False,
    )
    db.delete(row)
    db.commit()
