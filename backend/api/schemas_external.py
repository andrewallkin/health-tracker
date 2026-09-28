from __future__ import annotations

from pydantic import BaseModel, Field

from .schemas import MealSlot


class ExternalFoodCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    calories: int = Field(gt=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


class ExternalQuickLog(BaseModel):
    name: str = Field(min_length=1)
    slot: MealSlot
    calories: int = Field(ge=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)
    date: str | None = None


class ExternalLogFood(BaseModel):
    foodId: str
    servings: float = Field(gt=0)
    slot: MealSlot
    date: str | None = None


class ExternalWeightWrite(BaseModel):
    weightKg: float
    date: str | None = None


class ExternalApiKeyStatus(BaseModel):
    hasKey: bool
    prefix: str | None = None
    createdAt: str | None = None


class ExternalApiKeyCreated(BaseModel):
    apiKey: str
    prefix: str
    createdAt: str
