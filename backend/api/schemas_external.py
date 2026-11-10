from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from .schemas import MealSlot


class ExternalDayStatusWrite(BaseModel):
    notTracked: bool
    date: str | None = None


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


class ExternalFoodUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    calories: int | None = Field(default=None, gt=0)
    protein: float | None = Field(default=None, ge=0)
    carbs: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)


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


class ExternalMealUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    calories: int | None = Field(default=None, gt=0)
    protein: float | None = Field(default=None, ge=0)
    carbs: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)
    items: list[ExternalMealItemInput] | None = None


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


# --- Hevy read endpoints ------------------------------------------------------


class HevyWorkoutSummary(BaseModel):
    id: str
    title: str
    start_time: str
    end_time: str
    local_date: str
    routine_id: str | None = None
    garmin_activity_ids: list[str] = Field(default_factory=list)
    exercise_count: int
    set_count: int


class HevyWorkoutDetail(HevyWorkoutSummary):
    description: str | None = None
    exercises: list[dict] = Field(default_factory=list)


class HevyExerciseTemplateOut(BaseModel):
    id: str
    title: str
    type: str
    primary_muscle_group: str
    secondary_muscle_groups: list[str] = Field(default_factory=list)
    equipment: str
    is_custom: bool
    thumbnail_url: str | None = None


class HevyMetadata(BaseModel):
    muscle_groups: list[str]
    equipment: list[str]
    exercise_types: list[str]
    set_types: list[str]
    id_formats: str


class HevyProgressionEntry(BaseModel):
    """Weight sessions carry the e1RM/weight/volume fields; cardio sessions the
    duration/distance ones. Absent fields are omitted from the response."""

    date: str
    workout_id: str
    n_sets: int
    best_e1rm: float | None = None
    top_weight: float | None = None
    total_volume_kg: float | None = None
    best_duration_seconds: int | None = None
    best_distance_meters: int | None = None


class HevyPrValue(BaseModel):
    value: float | int
    date: str


class HevyPrRecord(HevyPrValue):
    metric: str


class HevyPrEntry(BaseModel):
    template_id: str
    title: str
    pr: HevyPrRecord
    best_e1rm: HevyPrValue | None = None
    history_count: int


class HevyHabitExercise(BaseModel):
    template_id: str
    title: str
    count: int


class HevyEquipmentUsage(BaseModel):
    equipment: str
    count: int


class HevyHabitProfile(BaseModel):
    exercises: list[HevyHabitExercise]
    equipment_profile: list[HevyEquipmentUsage]
