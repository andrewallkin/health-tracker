from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class RefreshTokenRow(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    family_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class DailyGoalRow(Base):
    __tablename__ = "daily_goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    calories: Mapped[int] = mapped_column(Integer, nullable=False)
    protein: Mapped[float] = mapped_column(Float, nullable=False)
    carbs: Mapped[float] = mapped_column(Float, nullable=False)
    fat: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (CheckConstraint("calories > 0", name="daily_goals_calories_positive"),)


class SavedFoodRow(Base):
    __tablename__ = "saved_foods"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    calories: Mapped[int] = mapped_column(Integer, nullable=False)
    protein: Mapped[float] = mapped_column(Float, nullable=False)
    carbs: Mapped[float] = mapped_column(Float, nullable=False)
    fat: Mapped[float] = mapped_column(Float, nullable=False)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    meal_items: Mapped[list[SavedMealItemRow]] = relationship(
        "SavedMealItemRow",
        back_populates="food",
    )


class SavedMealRow(Base):
    __tablename__ = "saved_meals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")
    calories: Mapped[int] = mapped_column(Integer, nullable=False)
    protein: Mapped[float] = mapped_column(Float, nullable=False)
    carbs: Mapped[float] = mapped_column(Float, nullable=False)
    fat: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    items: Mapped[list[SavedMealItemRow]] = relationship(
        "SavedMealItemRow",
        back_populates="meal",
        cascade="all, delete-orphan",
        order_by="SavedMealItemRow.sort_order",
    )


class SavedMealItemRow(Base):
    __tablename__ = "saved_meal_items"
    __table_args__ = (UniqueConstraint("meal_id", "food_id", name="uq_saved_meal_items_meal_food"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    meal_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("saved_meals.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    food_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("saved_foods.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    meal: Mapped[SavedMealRow] = relationship("SavedMealRow", back_populates="items")
    food: Mapped[SavedFoodRow] = relationship("SavedFoodRow", back_populates="meal_items")


class LogEntryRow(Base):
    __tablename__ = "log_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
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


class CheckInRow(Base):
    __tablename__ = "check_ins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    check_in_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    photos: Mapped[list[CheckInPhotoRow]] = relationship(
        "CheckInPhotoRow",
        back_populates="check_in",
        cascade="all, delete-orphan",
        order_by="CheckInPhotoRow.sort_order",
    )

    __table_args__ = (UniqueConstraint("user_id", "check_in_date", name="uq_check_ins_user_date"),)


class CheckInPhotoRow(Base):
    __tablename__ = "check_in_photos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    check_in_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("check_ins.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    image_url: Mapped[str] = mapped_column(String(512), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    check_in: Mapped[CheckInRow] = relationship("CheckInRow", back_populates="photos")


class AppSettingsRow(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    openai_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_model: Mapped[str] = mapped_column(String(64), nullable=False, default="gpt-5-nano")
    image_model: Mapped[str] = mapped_column(String(64), nullable=False, default="gpt-5-mini")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
