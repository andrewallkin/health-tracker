from __future__ import annotations

import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.api.mappers import (
    app_settings_to_schema,
    daily_goal_to_schema,
    get_or_create_app_settings,
    get_or_create_daily_goal,
    log_entry_to_schema,
    saved_meal_to_schema,
)
from backend.crypto import encrypt_api_key
from backend.database import Base
from backend.db_models import AppSettingsRow, DailyGoalRow, LogEntryRow, SavedMealRow, UserRow


class _MockGCS:
    def is_available(self) -> bool:
        return False


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _create_user(db) -> UserRow:
    user = UserRow(
        id=str(uuid.uuid4()),
        email=f"{uuid.uuid4()}@example.com",
        hashed_password="hash",
    )
    db.add(user)
    db.commit()
    return user


def test_get_or_create_daily_goal_defaults(db_session) -> None:
    user = _create_user(db_session)
    row = get_or_create_daily_goal(db_session, user.id)
    assert row.calories == 2200
    assert row.protein == 180

    again = get_or_create_daily_goal(db_session, user.id)
    assert again.id == row.id


def test_get_or_create_app_settings_defaults(db_session) -> None:
    user = _create_user(db_session)
    row = get_or_create_app_settings(db_session, user.id)
    assert row.text_model == "gpt-5-nano"
    assert row.image_model == "gpt-5-mini"

    again = get_or_create_app_settings(db_session, user.id)
    assert again.id == row.id


def test_daily_goal_to_schema(db_session) -> None:
    user = _create_user(db_session)
    row = DailyGoalRow(
        user_id=user.id,
        calories=2000,
        protein=150,
        carbs=200,
        fat=65,
    )
    db_session.add(row)
    db_session.commit()

    schema = daily_goal_to_schema(row)
    assert schema.calories == 2000
    assert schema.protein == 150


def test_saved_meal_and_log_entry_schemas(db_session) -> None:
    user = _create_user(db_session)
    meal = SavedMealRow(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name="Lunch bowl",
        image_url="/api/photos/user/meal.jpg",
        calories=500,
        protein=30,
        carbs=40,
        fat=20,
    )
    db_session.add(meal)
    db_session.commit()

    gcs = _MockGCS()
    meal_schema = saved_meal_to_schema(meal, gcs)
    assert meal_schema.name == "Lunch bowl"
    assert meal_schema.imageUrl == "/api/photos/user/meal.jpg"

    entry = LogEntryRow(
        id=str(uuid.uuid4()),
        user_id=user.id,
        log_date="2026-06-01",
        name="Lunch bowl",
        slot="lunch",
        time="12:00",
        servings=1,
        calories=500,
        protein=30,
        carbs=40,
        fat=20,
        saved_meal_id=meal.id,
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    entry_schema = log_entry_to_schema(entry, gcs)
    assert entry_schema.savedMealId == meal.id
    assert entry_schema.imageUrl == "/api/photos/user/meal.jpg"


def test_app_settings_to_schema_with_encrypted_key(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    monkeypatch.setenv("SETTINGS_ENCRYPTION_KEY", key)
    from backend.config import get_settings

    get_settings.cache_clear()

    user = _create_user(db_session)
    encrypted = encrypt_api_key("sk-test-key-1234567890")
    row = AppSettingsRow(
        user_id=user.id,
        openai_api_key_encrypted=encrypted,
        text_model="gpt-5-nano",
        image_model="gpt-5-mini",
    )
    db_session.add(row)
    db_session.commit()

    schema = app_settings_to_schema(row)
    assert schema.hasApiKey is True
    assert schema.apiKeyHint is not None
    assert schema.apiKeyHint.endswith("7890")

    get_settings.cache_clear()
