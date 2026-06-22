export type EstimateConfidence = "high" | "medium" | "low";
export type EstimateSource = "label" | "estimate";

export interface FoodEstimate {
  calories_kcal: number;
  macros_g: {
    protein: number;
    carbs: number;
    fat: number;
  };
  confidence: EstimateConfidence;
  source: EstimateSource;
  summary: string;
  assumptions: string[];
}

export interface DescribeFoodInput {
  note: string;
  photoUrl?: string;
}

import type { MealSlot } from "./nutrition";

export interface ReviewConfirmOptions {
  addToDay: boolean;
  saveAsMeal: boolean;
}

export interface ReviewedFoodPayload {
  name: string;
  slot: MealSlot;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  description?: string;
  imageUrl?: string;
}
