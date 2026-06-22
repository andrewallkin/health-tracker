from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...database import get_db
from ...db_models import DailyGoalRow
from ..mappers import daily_goal_to_schema, get_or_create_daily_goal
from ..schemas import DailyGoal

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=DailyGoal)
def get_goals(db: Session = Depends(get_db)) -> DailyGoal:
    return daily_goal_to_schema(get_or_create_daily_goal(db))


@router.put("", response_model=DailyGoal)
def update_goals(payload: DailyGoal, db: Session = Depends(get_db)) -> DailyGoal:
    row = get_or_create_daily_goal(db)
    row.calories = payload.calories
    row.protein = payload.protein
    row.carbs = payload.carbs
    row.fat = payload.fat
    db.commit()
    db.refresh(row)
    return daily_goal_to_schema(row)
