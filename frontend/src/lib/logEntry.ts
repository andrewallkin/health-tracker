import { scaleMacros } from "./aggregates";
import type { LogEntry, MealSlot, SavedMeal } from "../types/nutrition";

export function formatLogTime(date = new Date()): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function createLogEntryId(): string {
  return crypto.randomUUID();
}

export interface LogMealPayload {
  slot: MealSlot;
  servings: number;
}

export function buildLogEntryFromSavedMeal(
  meal: SavedMeal,
  { slot, servings }: LogMealPayload,
): LogEntry {
  const macros = scaleMacros(meal, servings);
  return {
    id: createLogEntryId(),
    name: meal.name,
    slot,
    time: formatLogTime(),
    servings,
    savedMealId: meal.id,
    imageUrl: meal.imageUrl,
    ...macros,
  };
}
