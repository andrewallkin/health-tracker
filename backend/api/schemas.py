from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


MealSlot = Literal["breakfast", "lunch", "dinner", "snack"]
EstimateConfidence = Literal["high", "medium", "low"]
EstimateSource = Literal["label", "estimate"]


class DailyGoal(BaseModel):
    calories: int = Field(gt=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


class SavedMeal(BaseModel):
    id: str
    name: str
    description: str | None = None
    imageUrl: str | None = None
    calories: int = Field(gt=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


class SavedMealCreate(BaseModel):
    name: str
    description: str | None = None
    imageUrl: str | None = None
    calories: int = Field(gt=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


class LogEntry(BaseModel):
    id: str
    logDate: str
    name: str
    slot: MealSlot
    time: str
    servings: float = Field(gt=0)
    calories: int = Field(ge=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)
    savedMealId: str | None = None


class LogEntryCreate(BaseModel):
    logDate: str
    name: str
    slot: MealSlot
    time: str
    servings: float = Field(gt=0)
    calories: int = Field(ge=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)
    savedMealId: str | None = None


class LogEntryUpdate(BaseModel):
    name: str | None = None
    slot: MealSlot | None = None
    time: str | None = None
    servings: float | None = Field(default=None, gt=0)
    calories: int | None = Field(default=None, ge=0)
    protein: float | None = Field(default=None, ge=0)
    carbs: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)
    savedMealId: str | None = None


class AiSettings(BaseModel):
    hasApiKey: bool
    apiKeyHint: str | None = None
    textModel: str
    imageModel: str


class AiSettingsUpdate(BaseModel):
    apiKey: str | None = None
    textModel: str
    imageModel: str


class ModelOption(BaseModel):
    id: str
    label: str
    supportsVision: bool


class ModelsResponse(BaseModel):
    models: list[ModelOption]


class EstimateRequest(BaseModel):
    note: str | None = None
    photos: list[str] = Field(default_factory=list)


class MacrosG(BaseModel):
    protein: float
    carbs: float
    fat: float


class FoodEstimateResponse(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    calories_kcal: int
    macros_g: MacrosG
    confidence: EstimateConfidence
    source: EstimateSource
    summary: str
    assumptions: list[str]
