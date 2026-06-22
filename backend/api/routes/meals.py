from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...database import get_db
from ...db_models import SavedMealRow
from ..mappers import saved_meal_to_schema
from ..schemas import SavedMeal, SavedMealCreate

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
