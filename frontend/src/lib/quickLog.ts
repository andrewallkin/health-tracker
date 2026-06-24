import type { LogEntry, MealSlot } from "../types/nutrition";
import { createLogEntryId, formatLogTime } from "./logEntry";

export interface QuickLogPayload {
  name: string;
  slot: MealSlot;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl?: string;
}

export function buildQuickLogEntry(payload: QuickLogPayload): LogEntry {
  return {
    id: createLogEntryId(),
    name: payload.name.trim(),
    slot: payload.slot,
    time: formatLogTime(),
    servings: 1,
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
    imageUrl: payload.imageUrl,
  };
}

export function updateQuickLogEntry(entry: LogEntry, payload: QuickLogPayload): LogEntry {
  return {
    ...entry,
    name: payload.name.trim(),
    slot: payload.slot,
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
  };
}

export function defaultMealSlot(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}
