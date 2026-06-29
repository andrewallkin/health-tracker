import type { FoodTag, SavedFood, SavedMeal } from "../types/nutrition";

export interface NewSavedFoodPayload {
  name: string;
  description?: string;
  imageUrl?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags?: FoodTag[];
}

export function findSavedFood(foods: SavedFood[], id: string): SavedFood | undefined {
  return foods.find((food) => food.id === id);
}

export function getMealsUsingFood(savedMeals: SavedMeal[], foodId: string): SavedMeal[] {
  return savedMeals.filter(
    (meal) =>
      meal.kind === "composed" && meal.items.some((item) => item.foodId === foodId),
  );
}

export function formatAffectedMealNames(meals: SavedMeal[]): string {
  return meals.map((meal) => meal.name).join(", ");
}

export interface FoodDeleteConflictDetail {
  message: string;
  affectedMealIds: string[];
  affectedMealNames: string[];
}

export function parseFoodDeleteConflict(detail: unknown): FoodDeleteConflictDetail | null {
  if (typeof detail !== "object" || detail === null) return null;
  const obj = detail as Record<string, unknown>;
  if (
    typeof obj.message === "string" &&
    Array.isArray(obj.affectedMealIds) &&
    Array.isArray(obj.affectedMealNames)
  ) {
    return {
      message: obj.message,
      affectedMealIds: obj.affectedMealIds as string[],
      affectedMealNames: obj.affectedMealNames as string[],
    };
  }
  return null;
}
