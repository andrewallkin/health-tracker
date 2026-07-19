from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


MealSlot = Literal["breakfast", "lunch", "dinner", "snack"]
SavedMealKind = Literal["manual", "composed"]
EstimateConfidence = Literal["high", "medium", "low"]
EstimateSource = Literal["label", "estimate"]


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
    imageUrl: str | None = None
    calories: int = Field(gt=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


class SavedFoodCreate(BaseModel):
    name: str
    description: str | None = None
    imageUrl: str | None = None
    calories: int = Field(gt=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


class SavedFoodUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    imageUrl: str | None = None
    calories: int | None = Field(default=None, gt=0)
    protein: float | None = Field(default=None, ge=0)
    carbs: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)


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


class GarminSettings(BaseModel):
    connected: bool
    email: str | None = None


class GarminConnectRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


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


class DayStatus(BaseModel):
    id: str
    statusDate: str


class DayStatusUpsert(BaseModel):
    statusDate: str


HrvStatus = Literal["balanced", "unbalanced", "low", "poor", "unavailable"]
ActivityType = Literal[
    "strength_training",
    "running",
    "cycling",
    "walking",
    "hiking",
    "cardio",
    "other",
]


class HealthActivity(BaseModel):
    id: str
    name: str
    type: ActivityType
    startTime: str
    durationMin: int
    calories: int
    avgHr: int
    distanceKm: float | None = None


class DailyHealth(BaseModel):
    date: str
    steps: int
    stepGoal: int
    totalCalories: int
    activeCalories: int
    bmrCalories: int
    restingHr: int
    minHr: int
    maxHr: int
    avgRestingHr7d: int
    sleepHours: float
    deepSleepHours: float
    remSleepHours: float
    lightSleepHours: float
    sleepAvgHr: int
    sleepScore: int | None = None
    hrv: int | None = None
    hrvStatus: HrvStatus
    hrvWeeklyAvg: int | None = None
    activities: list[HealthActivity] = Field(default_factory=list)


class HealthDayError(BaseModel):
    date: str
    message: str


class HealthDayResponse(BaseModel):
    day: DailyHealth | None = None
    errors: list[HealthDayError] = Field(default_factory=list)


class HealthDaysResponse(BaseModel):
    days: list[DailyHealth] = Field(default_factory=list)
    errors: list[HealthDayError] = Field(default_factory=list)
