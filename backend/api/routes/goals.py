from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database import get_db
from ...db_models import UserRow
from ..deps import get_current_user
from ..mappers import daily_goal_to_schema, get_daily_goal, get_or_create_daily_goal
from ..schemas import DailyGoal

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=DailyGoal)
def get_goals(
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> DailyGoal:
    row = get_daily_goal(db, user.id)
    if row is None:
        raise HTTPException(status_code=404, detail="Goals not configured")
    return daily_goal_to_schema(row)


@router.put("", response_model=DailyGoal)
def update_goals(
    payload: DailyGoal,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> DailyGoal:
    row = get_or_create_daily_goal(db, user.id)
    row.calories = payload.calories
    row.protein = payload.protein
    row.carbs = payload.carbs
    row.fat = payload.fat
    db.commit()
    db.refresh(row)
    return daily_goal_to_schema(row)
