import { parseNonNegative, parsePositive } from "../../../lib/numericInput";
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
