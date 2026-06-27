#!/usr/bin/env python3
"""Populate PostgreSQL with dummy nutrition data for development."""

from __future__ import annotations

import argparse
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from backend.auth import get_password_hash  # noqa: E402
from backend.database import Base, SessionLocal, engine  # noqa: E402
from backend.api.mappers import DEFAULT_DAILY_GOAL  # noqa: E402
from backend.db_models import (  # noqa: E402
    AppSettingsRow,
    DailyGoalRow,
    LogEntryRow,
    SavedMealRow,
    UserRow,
)

DAILY_GOAL = DEFAULT_DAILY_GOAL

# Seed meals and log entries are intentionally photo-free (no image_url).
SAVED_MEALS = [
    {
        "id": "meal-1",
        "name": "Sweet potato chilli mince",
        "description": "Lean beef mince with kidney beans, sweet potato, and spices.",
        "calories": 580,
        "protein": 42,
        "carbs": 52,
        "fat": 22,
    },
    {
        "id": "meal-2",
        "name": "Protein shake",
        "description": "Whey, banana, oat milk.",
        "calories": 210,
        "protein": 40,
        "carbs": 8,
        "fat": 3,
    },
    {
        "id": "meal-3",
        "name": "Chicken stir-fry & rice",
        "description": "Chicken thigh, mixed veg, jasmine rice, soy glaze.",
        "calories": 620,
        "protein": 48,
        "carbs": 62,
        "fat": 18,
    },
    {
        "id": "meal-4",
        "name": "Greek yogurt & berries",
        "description": "Full-fat yogurt, blueberries, honey drizzle.",
        "calories": 320,
        "protein": 28,
        "carbs": 32,
        "fat": 8,
    },
    {
        "id": "meal-5",
        "name": "Overnight oats",
        "description": "Rolled oats, peanut butter, chia seeds, cinnamon.",
        "calories": 410,
        "protein": 18,
        "carbs": 48,
        "fat": 16,
    },
    {
        "id": "meal-6",
        "name": "Tuna salad wrap",
        "description": "Wholemeal wrap, tuna, Greek yogurt, cucumber.",
        "calories": 380,
        "protein": 32,
        "carbs": 36,
        "fat": 12,
    },
]

TODAY_ENTRIES = [
    {
        "name": "Greek yogurt & berries",
        "slot": "breakfast",
        "time": "07:45",
        "servings": 1,
        "calories": 320,
        "protein": 28,
        "carbs": 32,
        "fat": 8,
        "saved_meal_id": "meal-4",
    },
    {
        "name": "Oat latte",
        "slot": "breakfast",
        "time": "08:10",
        "servings": 1,
        "calories": 120,
        "protein": 3,
        "carbs": 18,
        "fat": 4,
        "saved_meal_id": None,
    },
    {
        "name": "Sweet potato chilli mince",
        "slot": "lunch",
        "time": "12:30",
        "servings": 1,
        "calories": 580,
        "protein": 42,
        "carbs": 52,
        "fat": 22,
        "saved_meal_id": "meal-1",
    },
    {
        "name": "Protein shake",
        "slot": "snack",
        "time": "15:20",
        "servings": 1,
        "calories": 210,
        "protein": 40,
        "carbs": 8,
        "fat": 3,
        "saved_meal_id": "meal-2",
    },
    {
        "name": "Chicken stir-fry & rice",
        "slot": "dinner",
        "time": "19:00",
        "servings": 1,
        "calories": 620,
        "protein": 48,
        "carbs": 62,
        "fat": 18,
        "saved_meal_id": "meal-3",
    },
    {
        "name": "Dark chocolate",
        "slot": "snack",
        "time": "21:15",
        "servings": 0.5,
        "calories": 130,
        "protein": 2,
        "carbs": 12,
        "fat": 9,
        "saved_meal_id": None,
    },
]

HISTORICAL_PATTERNS = [
    [
        ("Overnight oats", "breakfast", "07:30", 1, 410, 18, 48, 16, "meal-5"),
        ("Chicken stir-fry & rice", "lunch", "12:45", 1, 620, 48, 62, 18, "meal-3"),
        ("Protein shake", "snack", "16:00", 1, 210, 40, 8, 3, "meal-2"),
    ],
    [
        ("Greek yogurt & berries", "breakfast", "08:00", 1, 320, 28, 32, 8, "meal-4"),
        ("Tuna salad wrap", "lunch", "13:00", 1, 380, 32, 36, 12, "meal-6"),
        ("Sweet potato chilli mince", "dinner", "19:30", 1, 580, 42, 52, 22, "meal-1"),
    ],
    [
        ("Overnight oats", "breakfast", "07:15", 1, 410, 18, 48, 16, "meal-5"),
        ("Sweet potato chilli mince", "lunch", "12:15", 1, 580, 42, 52, 22, "meal-1"),
        ("Apple", "snack", "15:45", 1, 95, 0, 25, 0, None),
        ("Chicken stir-fry & rice", "dinner", "18:45", 1, 620, 48, 62, 18, "meal-3"),
    ],
    [
        ("Greek yogurt & berries", "breakfast", "07:50", 1, 320, 28, 32, 8, "meal-4"),
        ("Tuna salad wrap", "lunch", "12:30", 1, 380, 32, 36, 12, "meal-6"),
        ("Protein shake", "snack", "17:00", 1, 210, 40, 8, 3, "meal-2"),
    ],
    [
        ("Overnight oats", "breakfast", "07:20", 1, 410, 18, 48, 16, "meal-5"),
        ("Chicken stir-fry & rice", "lunch", "13:15", 1, 620, 48, 62, 18, "meal-3"),
        ("Dark chocolate", "snack", "20:30", 0.5, 130, 2, 12, 9, None),
    ],
]


def clear_user_seed_data(db: Session, user_id: str) -> None:
    """Remove existing nutrition rows for a user before re-seeding."""
    db.query(LogEntryRow).filter(LogEntryRow.user_id == user_id).delete(synchronize_session=False)
    db.query(SavedMealRow).filter(SavedMealRow.user_id == user_id).delete(synchronize_session=False)
    db.query(DailyGoalRow).filter(DailyGoalRow.user_id == user_id).delete(synchronize_session=False)
    db.query(AppSettingsRow).filter(AppSettingsRow.user_id == user_id).delete(synchronize_session=False)


def reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed(email: str = "demo@example.com", password: str = "password123") -> None:
    today = date.today()
    db = SessionLocal()
    try:
        user = db.query(UserRow).filter(UserRow.email == email.strip().lower()).first()
        if user is None:
            user = UserRow(
                email=email.strip().lower(),
                hashed_password=get_password_hash(password),
            )
            db.add(user)
            db.flush()
        else:
            clear_user_seed_data(db, user.id)

        db.add(DailyGoalRow(user_id=user.id, **DAILY_GOAL))

        for meal in SAVED_MEALS:
            db.add(SavedMealRow(user_id=user.id, image_url=None, **meal))

        db.add(
            AppSettingsRow(
                user_id=user.id,
                openai_api_key_encrypted=None,
                text_model="gpt-5-nano",
                image_model="gpt-5-mini",
            )
        )

        for entry in TODAY_ENTRIES:
            db.add(
                LogEntryRow(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    log_date=today.isoformat(),
                    image_url=None,
                    **entry,
                )
            )

        for day_offset in range(1, 22):
            log_date = (today - timedelta(days=day_offset)).isoformat()
            pattern = HISTORICAL_PATTERNS[day_offset % len(HISTORICAL_PATTERNS)]
            for name, slot, time, servings, cal, p, c, f, meal_id in pattern:
                db.add(
                    LogEntryRow(
                        id=str(uuid.uuid4()),
                        user_id=user.id,
                        log_date=log_date,
                        name=name,
                        slot=slot,
                        time=time,
                        servings=servings,
                        calories=cal,
                        protein=p,
                        carbs=c,
                        fat=f,
                        saved_meal_id=meal_id,
                        image_url=None,
                    )
                )

        db.commit()
        print(
            f"Seeded user {user.email} with daily goal, {len(SAVED_MEALS)} saved meals, "
            f"and log entries through {today.isoformat()}"
        )
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed nutrition database with dummy data")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables before seeding")
    parser.add_argument("--email", default="demo@example.com", help="Seed data owner email")
    parser.add_argument("--password", default="password123", help="Seed data owner password")
    args = parser.parse_args()

    if args.reset:
        reset_db()
    else:
        Base.metadata.create_all(bind=engine)

    seed(email=args.email, password=args.password)


if __name__ == "__main__":
    main()
