from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


MealSlot = Literal["breakfast", "lunch", "dinner", "snack"]
SavedMealKind = Literal["manual", "composed"]
FoodTag = Literal["protein", "carb", "veg", "dairy", "topping", "sweet", "snack"]
EstimateConfidence = Literal["high", "medium", "low"]
EstimateSource = Literal["label", "estimate"]

FOOD_TAGS: frozenset[str] = frozenset(
    {"protein", "carb", "veg", "dairy", "topping", "sweet", "snack"}
)


class DailyGoal(BaseModel):
    calories: int = Field(gt=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


class SavedMealItem(BaseModel):
    foodId: str
    quantity: float = Field(gt=0)
    sortOrder: int = Field(ge=0)
    foodName: str
    calories: int = Field(ge=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


class SavedMealItemInput(BaseModel):
    foodId: str
    quantity: float = Field(gt=0)
    sortOrder: int = Field(default=0, ge=0)


class SavedMeal(BaseModel):
    id: str
    name: str
    description: str | None = None
    imageUrl: str | None = None
    kind: SavedMealKind = "manual"
    calories: int = Field(gt=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)
    items: list[SavedMealItem] = Field(default_factory=list)


class SavedMealCreate(BaseModel):
    name: str
    description: str | None = None
    imageUrl: str | None = None
    calories: int | None = Field(default=None, gt=0)
    protein: float | None = Field(default=None, ge=0)
    carbs: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)
    items: list[SavedMealItemInput] | None = None

    @model_validator(mode="after")
    def validate_mode(self) -> SavedMealCreate:
        if self.items is not None:
            if len(self.items) == 0:
                raise ValueError("items must be non-empty for composed meals")
        elif self.calories is None or self.protein is None or self.carbs is None or self.fat is None:
            raise ValueError("calories, protein, carbs, and fat are required for manual meals")
        return self


class SavedMealUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    imageUrl: str | None = None
    calories: int | None = Field(default=None, gt=0)
    protein: float | None = Field(default=None, ge=0)
    carbs: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)
    items: list[SavedMealItemInput] | None = None


class SavedFood(BaseModel):
    id: str
    name: str
    description: str | None = None
    calories: int = Field(gt=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)
    tags: list[FoodTag] = Field(default_factory=list)


class SavedFoodCreate(BaseModel):
    name: str
    description: str | None = None
    calories: int = Field(gt=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)
    tags: list[FoodTag] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags: list[FoodTag]) -> list[FoodTag]:
        if len(tags) != len(set(tags)):
            raise ValueError("duplicate tags are not allowed")
        return tags


class SavedFoodUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    calories: int | None = Field(default=None, gt=0)
    protein: float | None = Field(default=None, ge=0)
    carbs: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)
    tags: list[FoodTag] | None = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags: list[FoodTag] | None) -> list[FoodTag] | None:
        if tags is not None and len(tags) != len(set(tags)):
            raise ValueError("duplicate tags are not allowed")
        return tags


class FoodDeleteConflict(BaseModel):
    detail: str
    affectedMealIds: list[str]
    affectedMealNames: list[str]


class PhotoUploadResponse(BaseModel):
    path: str
    url: str


class SignedUrlResponse(BaseModel):
    url: str


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
    imageUrl: str | None = None


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
    imageUrl: str | None = None


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
    imageUrl: str | None = None


class AiSettings(BaseModel):
    hasApiKey: bool
    apiKeyHint: str | None = None
    textModel: str
    imageModel: str


class AiSettingsUpdate(BaseModel):
    apiKey: str | None = None
    clearApiKey: bool = False
    textModel: str
    imageModel: str


class ModelOption(BaseModel):
    id: str
    label: str
    supportsVision: bool
    recommendedFor: Literal["text", "image"] | None = None


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


class CheckInPhoto(BaseModel):
    id: str
    imageUrl: str
    imagePath: str
    sortOrder: int


class CheckIn(BaseModel):
    id: str
    checkInDate: str
    recordedAt: str
    weightKg: float | None = None
    notes: str | None = None
    photos: list[CheckInPhoto]


class CheckInUpsert(BaseModel):
    checkInDate: str
    weightKg: float | None = None
    notes: str | None = None
    photoPaths: list[str] = Field(default_factory=list, max_length=10)
