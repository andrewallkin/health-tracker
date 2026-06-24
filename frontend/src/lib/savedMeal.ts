import type { SavedMeal } from "../types/nutrition";

export interface NewSavedMealPayload {
  name: string;
  description?: string;
  imageUrl?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function createSavedMealId(): string {
  return crypto.randomUUID();
}

export function buildSavedMeal(payload: NewSavedMealPayload): SavedMeal {
  const meal: SavedMeal = {
    id: createSavedMealId(),
    name: payload.name.trim(),
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
  };

  const description = payload.description?.trim();
  const imageUrl = payload.imageUrl?.trim();

  if (description) meal.description = description;
  if (imageUrl) meal.imageUrl = imageUrl;

  return meal;
}

export function findSavedMeal(meals: SavedMeal[], id: string): SavedMeal | undefined {
  return meals.find((meal) => meal.id === id);
}
