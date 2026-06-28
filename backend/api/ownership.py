from __future__ import annotations

from sqlalchemy.orm import Session

from ..db_models import CheckInRow, LogEntryRow, SavedFoodRow, SavedMealRow


def get_owned_food(db: Session, user_id: str, food_id: str) -> SavedFoodRow | None:
    return (
        db.query(SavedFoodRow)
        .filter(SavedFoodRow.id == food_id, SavedFoodRow.user_id == user_id)
        .first()
    )


def get_owned_meal(db: Session, user_id: str, meal_id: str) -> SavedMealRow | None:
    return (
        db.query(SavedMealRow)
        .filter(SavedMealRow.id == meal_id, SavedMealRow.user_id == user_id)
        .first()
    )


def get_owned_entry(db: Session, user_id: str, entry_id: str) -> LogEntryRow | None:
    return (
        db.query(LogEntryRow)
        .filter(LogEntryRow.id == entry_id, LogEntryRow.user_id == user_id)
        .first()
    )


def get_owned_check_in(db: Session, user_id: str, check_in_id: str) -> CheckInRow | None:
    return (
        db.query(CheckInRow)
        .filter(CheckInRow.id == check_in_id, CheckInRow.user_id == user_id)
        .first()
    )


def get_check_in_for_date(db: Session, user_id: str, check_in_date: str) -> CheckInRow | None:
    return (
        db.query(CheckInRow)
        .filter(CheckInRow.user_id == user_id, CheckInRow.check_in_date == check_in_date)
        .first()
    )
