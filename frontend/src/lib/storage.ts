import { toDateKey } from "./dates";
import type { DailyGoal, LogEntry, MealSlot, SavedMeal } from "../types/nutrition";

export const ENTRIES_STORAGE_PREFIX = "health_dashboard:entries:";

const MEAL_SLOTS = new Set<MealSlot>(["breakfast", "lunch", "dinner", "snack"]);

function storageKey(dateKey: string): string {
  return `${ENTRIES_STORAGE_PREFIX}${dateKey}`;
}

function isLogEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.slot === "string" &&
    MEAL_SLOTS.has(entry.slot as MealSlot) &&
    typeof entry.time === "string" &&
    typeof entry.servings === "number" &&
    typeof entry.calories === "number" &&
    typeof entry.protein === "number" &&
    typeof entry.carbs === "number" &&
    typeof entry.fat === "number" &&
    (entry.savedMealId === undefined || typeof entry.savedMealId === "string")
  );
}

function parseEntries(raw: string | null): LogEntry[] | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isLogEntry)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadEntries(dateKey: string): LogEntry[] {
  const parsed = parseEntries(localStorage.getItem(storageKey(dateKey)));
  if (parsed) return parsed;

  return [];
}

export function saveEntries(dateKey: string, entries: LogEntry[]): void {
  try {
    localStorage.setItem(storageKey(dateKey), JSON.stringify(entries));
  } catch {
    // ignore quota / private mode errors
  }
}

export function listStoredDates(): string[] {
  const dates: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(ENTRIES_STORAGE_PREFIX)) continue;
      dates.push(key.slice(ENTRIES_STORAGE_PREFIX.length));
    }
  } catch {
    return [];
  }
  return dates.sort();
}

/** @deprecated Use loadEntries(toDateKey()) */
export function loadTodayEntries(): LogEntry[] {
  return loadEntries(toDateKey());
}

/** @deprecated Use saveEntries(toDateKey(), entries) */
export function saveTodayEntries(entries: LogEntry[]): void {
  saveEntries(toDateKey(), entries);
}

export function clearTodayEntries(): void {
  localStorage.removeItem(storageKey(toDateKey()));
}

const GOAL_STORAGE_KEY = "health_dashboard:goal";

function isDailyGoal(value: unknown): value is DailyGoal {
  if (!value || typeof value !== "object") return false;
  const goal = value as Record<string, unknown>;
  return (
    typeof goal.calories === "number" &&
    typeof goal.protein === "number" &&
    typeof goal.carbs === "number" &&
    typeof goal.fat === "number" &&
    goal.calories > 0 &&
    goal.protein >= 0 &&
    goal.carbs >= 0 &&
    goal.fat >= 0
  );
}

export function loadDailyGoal(fallback: DailyGoal): DailyGoal {
  try {
    const raw = localStorage.getItem(GOAL_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (!isDailyGoal(parsed)) return fallback;

    return {
      calories: Math.round(parsed.calories),
      protein: Math.round(parsed.protein),
      carbs: Math.round(parsed.carbs),
      fat: Math.round(parsed.fat),
    };
  } catch {
    return fallback;
  }
}

export function saveDailyGoal(goal: DailyGoal): void {
  try {
    localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goal));
  } catch {
    // ignore quota / private mode errors
  }
}

const SAVED_MEALS_STORAGE_KEY = "health_dashboard:saved-meals";

function isSavedMeal(value: unknown): value is SavedMeal {
  if (!value || typeof value !== "object") return false;
  const meal = value as Record<string, unknown>;
  return (
    typeof meal.id === "string" &&
    typeof meal.name === "string" &&
    typeof meal.calories === "number" &&
    typeof meal.protein === "number" &&
    typeof meal.carbs === "number" &&
    typeof meal.fat === "number" &&
    meal.calories > 0 &&
    meal.protein >= 0 &&
    meal.carbs >= 0 &&
    meal.fat >= 0 &&
    (meal.description === undefined || typeof meal.description === "string") &&
    (meal.imageUrl === undefined || typeof meal.imageUrl === "string") &&
    (meal.kind === undefined ||
      meal.kind === "manual" ||
      meal.kind === "composed") &&
    (meal.items === undefined || Array.isArray(meal.items))
  );
}

export function loadSavedMeals(): SavedMeal[] {
  try {
    const raw = localStorage.getItem(SAVED_MEALS_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isSavedMeal)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

export function saveSavedMeals(meals: SavedMeal[]): void {
  try {
    localStorage.setItem(SAVED_MEALS_STORAGE_KEY, JSON.stringify(meals));
  } catch {
    // ignore quota / private mode errors
  }
}
