from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class DailyGoalRow(Base):
    __tablename__ = "daily_goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    calories: Mapped[int] = mapped_column(Integer, nullable=False)
    protein: Mapped[float] = mapped_column(Float, nullable=False)
    carbs: Mapped[float] = mapped_column(Float, nullable=False)
    fat: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint("id = 1", name="daily_goals_singleton"),
        CheckConstraint("calories > 0", name="daily_goals_calories_positive"),
    )


class SavedMealRow(Base):
    __tablename__ = "saved_meals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    calories: Mapped[int] = mapped_column(Integer, nullable=False)
    protein: Mapped[float] = mapped_column(Float, nullable=False)
    carbs: Mapped[float] = mapped_column(Float, nullable=False)
    fat: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class LogEntryRow(Base):
    __tablename__ = "log_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    log_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    slot: Mapped[str] = mapped_column(String(16), nullable=False)
    time: Mapped[str] = mapped_column(String(5), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    servings: Mapped[float] = mapped_column(Float, nullable=False)
    calories: Mapped[int] = mapped_column(Integer, nullable=False)
    protein: Mapped[float] = mapped_column(Float, nullable=False)
    carbs: Mapped[float] = mapped_column(Float, nullable=False)
    fat: Mapped[float] = mapped_column(Float, nullable=False)
    saved_meal_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("saved_meals.id", ondelete="SET NULL"),
        nullable=True,
    )
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    saved_meal: Mapped[SavedMealRow | None] = relationship("SavedMealRow")


class AppSettingsRow(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    openai_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_model: Mapped[str] = mapped_column(String(64), nullable=False, default="gpt-5-nano")
    image_model: Mapped[str] = mapped_column(String(64), nullable=False, default="gpt-5-mini")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (CheckConstraint("id = 1", name="app_settings_singleton"),)
