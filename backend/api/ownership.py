from __future__ import annotations

from sqlalchemy.orm import Session

from ..db_models import LogEntryRow, SavedMealRow


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
