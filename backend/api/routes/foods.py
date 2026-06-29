from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...database import get_db
from ...db_models import SavedFoodRow, UserRow
from ...gcs import GCSService, get_gcs_service
from ..compose import get_meals_using_food, recompute_meals_for_food
from ..deps import get_current_user
from ..mappers import saved_food_to_schema
from ..ownership import get_owned_food
from ..photo_storage import normalize_image_url_for_storage
from ..schemas import FoodDeleteConflict, SavedFood, SavedFoodCreate, SavedFoodUpdate

router = APIRouter(prefix="/foods", tags=["foods"])


@router.get("", response_model=list[SavedFood])
def list_foods(
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> list[SavedFood]:
    rows = (
        db.query(SavedFoodRow)
        .filter(SavedFoodRow.user_id == user.id)
        .order_by(SavedFoodRow.name)
        .all()
    )
    return [saved_food_to_schema(row, gcs) for row in rows]


@router.post("", response_model=SavedFood, status_code=201)
def create_food(
    payload: SavedFoodCreate,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> SavedFood:
    row = SavedFoodRow(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=payload.name.strip(),
        description=payload.description,
        image_url=normalize_image_url_for_storage(payload.imageUrl, user_id=user.id),
        calories=payload.calories,
        protein=payload.protein,
        carbs=payload.carbs,
        fat=payload.fat,
        tags=list(payload.tags),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return saved_food_to_schema(row, gcs)


@router.patch("/{food_id}", response_model=SavedFood)
def update_food(
    food_id: str,
    payload: SavedFoodUpdate,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> SavedFood:
    row = get_owned_food(db, user.id, food_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Food not found")

    updates = payload.model_dump(exclude_unset=True)
    field_map = {
        "name": "name",
        "description": "description",
        "imageUrl": "image_url",
        "calories": "calories",
        "protein": "protein",
        "carbs": "carbs",
        "fat": "fat",
        "tags": "tags",
    }
    for api_field, orm_field in field_map.items():
        if api_field in updates:
            value = updates[api_field]
            if api_field == "name" and isinstance(value, str):
                value = value.strip()
            if api_field == "imageUrl":
                value = normalize_image_url_for_storage(value, user_id=user.id)
            if api_field == "tags" and value is not None:
                value = list(value)
            setattr(row, orm_field, value)

    db.commit()
    recompute_meals_for_food(db, user.id, food_id)
    db.commit()
    db.refresh(row)
    return saved_food_to_schema(row, gcs)


@router.delete("/{food_id}", status_code=204, responses={409: {"model": FoodDeleteConflict}})
def delete_food(
    food_id: str,
    confirm: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> None:
    row = get_owned_food(db, user.id, food_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Food not found")

    affected_meals = get_meals_using_food(db, user.id, food_id)
    if affected_meals and not confirm:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Food is used in saved meals",
                "affectedMealIds": [meal.id for meal in affected_meals],
                "affectedMealNames": [meal.name for meal in affected_meals],
            },
        )

    from ..compose import cascade_delete_food

    cascade_delete_food(db, user.id, row)
    db.commit()
