import type { ReviewedFoodPayload } from "../types/foodEstimate";
import type { FoodTag } from "../types/nutrition";
import type { QuickLogPayload } from "./quickLog";
import type { NewSavedFoodPayload } from "./savedFood";
import type { NewSavedMealPayload } from "./savedMeal";

export const MAX_ESTIMATE_PHOTOS = 5;

export function canEstimateFood(note: string, photoUrls: string[]): boolean {
  return note.trim().length > 0 || photoUrls.length > 0;
}

export function selectedEstimateImageUrl(
  photoUrls: string[],
  selectedIndex: number,
): string | undefined {
  if (selectedIndex < 0 || selectedIndex >= photoUrls.length) return undefined;
  return photoUrls[selectedIndex];
}

export function reviewedToQuickLog(payload: ReviewedFoodPayload): QuickLogPayload {
  return {
    name: payload.name,
    slot: payload.slot,
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
    imageUrl: payload.imageUrl,
  };
}

export function reviewedToSavedMeal(payload: ReviewedFoodPayload): NewSavedMealPayload {
  return {
    name: payload.name,
    description: payload.description,
    imageUrl: payload.imageUrl,
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
  };
}

export function reviewedToSavedFood(
  payload: ReviewedFoodPayload,
  tags?: FoodTag[],
): NewSavedFoodPayload {
  return {
    name: payload.name,
    description: payload.description,
    imageUrl: payload.imageUrl,
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
    tags: tags && tags.length > 0 ? tags : undefined,
  };
}
