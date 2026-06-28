import type { MacroTotals, SavedFood, SavedMealItemInput } from "../types/nutrition";
import { scaleMacros } from "./aggregates";

export interface FoodComponentSelection {
  foodId: string;
  quantity: number;
}

export function componentsToMealItems(
  components: FoodComponentSelection[],
): SavedMealItemInput[] {
  return components.map((component, index) => ({
    foodId: component.foodId,
    quantity: component.quantity,
    sortOrder: index,
  }));
}

export function sumFoodComponents(
  foods: SavedFood[],
  components: FoodComponentSelection[],
): MacroTotals {
  const byId = new Map(foods.map((food) => [food.id, food]));
  return components.reduce<MacroTotals>(
    (acc, component) => {
      const food = byId.get(component.foodId);
      if (!food) return acc;
      const scaled = scaleMacros(food, component.quantity);
      return {
        calories: acc.calories + scaled.calories,
        protein: acc.protein + scaled.protein,
        carbs: acc.carbs + scaled.carbs,
        fat: acc.fat + scaled.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
