from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

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


class ExternalMealItemInput(BaseModel):
    foodId: str
    quantity: float = Field(gt=0)


class ExternalMealCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    calories: int | None = Field(default=None, gt=0)
    protein: float | None = Field(default=None, ge=0)
    carbs: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)
    items: list[ExternalMealItemInput] | None = None

    @model_validator(mode="after")
    def validate_mode(self) -> ExternalMealCreate:
        if self.items is not None:
            if len(self.items) == 0:
                raise ValueError("items must be non-empty for composed meals")
        elif self.calories is None or self.protein is None or self.carbs is None or self.fat is None:
            raise ValueError("calories, protein, carbs, and fat are required for manual meals")
        return self


class ExternalLogMeal(BaseModel):
    mealId: str
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
