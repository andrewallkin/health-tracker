from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database import get_db
from ...db_models import LogEntryRow, SavedMealRow
from ..mappers import saved_meal_to_schema
from ..schemas import SavedMeal, SavedMealCreate, SavedMealUpdate

router = APIRouter(prefix="/meals", tags=["meals"])


@router.get("", response_model=list[SavedMeal])
def list_meals(db: Session = Depends(get_db)) -> list[SavedMeal]:
    rows = db.query(SavedMealRow).order_by(SavedMealRow.name).all()
    return [saved_meal_to_schema(row) for row in rows]


@router.post("", response_model=SavedMeal, status_code=201)
def create_meal(payload: SavedMealCreate, db: Session = Depends(get_db)) -> SavedMeal:
    row = SavedMealRow(
        id=str(uuid.uuid4()),
        name=payload.name.strip(),
        description=payload.description,
        image_url=payload.imageUrl,
        calories=payload.calories,
        protein=payload.protein,
        carbs=payload.carbs,
        fat=payload.fat,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return saved_meal_to_schema(row)


@router.patch("/{meal_id}", response_model=SavedMeal)
def update_meal(
    meal_id: str,
    payload: SavedMealUpdate,
    db: Session = Depends(get_db),
) -> SavedMeal:
    row = db.get(SavedMealRow, meal_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Meal not found")

    updates = payload.model_dump(exclude_unset=True)
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
            value = updates[api_field]
            if api_field == "name" and isinstance(value, str):
                value = value.strip()
            setattr(row, orm_field, value)

    db.commit()
    db.refresh(row)
    return saved_meal_to_schema(row)


@router.delete("/{meal_id}", status_code=204)
def delete_meal(meal_id: str, db: Session = Depends(get_db)) -> None:
    row = db.get(SavedMealRow, meal_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    # Unlink log entries; FK ondelete=SET NULL when SQLite foreign keys are enabled.
    db.query(LogEntryRow).filter(LogEntryRow.saved_meal_id == meal_id).update(
        {LogEntryRow.saved_meal_id: None},
        synchronize_session=False,
    )
    db.delete(row)
    db.commit()
