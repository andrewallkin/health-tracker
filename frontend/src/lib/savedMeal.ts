import type { FoodComponentSelection } from "./composeFoods";
import type { SavedMealItemInput } from "../types/nutrition";

export interface NewSavedMealPayload {
  name: string;
  description?: string;
  imageUrl?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  items?: SavedMealItemInput[];
}

export function createSavedMealId(): string {
  return crypto.randomUUID();
}

export function findSavedMeal<T extends { id: string }>(meals: T[], id: string): T | undefined {
  return meals.find((meal) => meal.id === id);
}

export function mealItemsToSelections(items: SavedMealItemInput[]): FoodComponentSelection[] {
  return items.map((item) => ({
    foodId: item.foodId,
    quantity: item.quantity,
  }));
}

export function formatMealIngredientList(
  items: { foodName: string; quantity: number }[],
): string {
  return items
    .map((item) => (item.quantity === 1 ? item.foodName : `${item.foodName} ×${item.quantity}`))
    .join(" · ");
}
