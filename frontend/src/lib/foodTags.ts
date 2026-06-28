import type { FoodTag } from "../types/nutrition";

export const FOOD_TAGS: FoodTag[] = [
  "protein",
  "carb",
  "veg",
  "dairy",
  "topping",
  "sweet",
  "snack",
];

export const FOOD_TAG_LABELS: Record<FoodTag, string> = {
  protein: "Protein",
  carb: "Carb",
  veg: "Veg",
  dairy: "Dairy",
  topping: "Topping",
  sweet: "Sweet",
  snack: "Snack",
};

export function foodMatchesTagFilter(foodTags: FoodTag[] | undefined, filter: FoodTag | null): boolean {
  if (!filter) return true;
  return (foodTags ?? []).includes(filter);
}
