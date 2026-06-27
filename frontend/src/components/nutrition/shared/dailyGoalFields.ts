import type { DailyGoal } from "../../../types/nutrition";

export interface DailyGoalFieldValues {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

export function dailyGoalFromFieldValues(values: DailyGoalFieldValues): DailyGoal {
  return {
    calories: parsePositive(values.calories),
    protein: parseNonNegative(values.protein),
    carbs: parseNonNegative(values.carbs),
    fat: parseNonNegative(values.fat),
  };
}

export function fieldValuesFromDailyGoal(goal: DailyGoal): DailyGoalFieldValues {
  return {
    calories: String(goal.calories),
    protein: String(goal.protein),
    carbs: String(goal.carbs),
    fat: String(goal.fat),
  };
}

export function isValidDailyGoal(goal: DailyGoal): boolean {
  return goal.calories > 0;
}

function parseNonNegative(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function parsePositive(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
}
