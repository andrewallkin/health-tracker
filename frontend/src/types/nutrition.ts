export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type FoodTag = "protein" | "carb" | "veg" | "dairy" | "topping" | "sweet" | "snack";

export type SavedMealKind = "manual" | "composed";

export interface DailyGoal {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface SavedMealItem {
  foodId: string;
  quantity: number;
  sortOrder: number;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface SavedMealItemInput {
  foodId: string;
  quantity: number;
  sortOrder?: number;
}

export interface SavedFood {
  id: string;
  name: string;
  description?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags?: FoodTag[];
}

export interface SavedMeal {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  kind: SavedMealKind;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: SavedMealItem[];
}

export interface LogEntry {
  id: string;
  logDate?: string;
  name: string;
  slot: MealSlot;
  time: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  savedMealId?: string;
  imageUrl?: string;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailySummary {
  goal: DailyGoal;
  consumed: MacroTotals;
  remaining: MacroTotals;
}

export interface DailyTotals {
  date: string;
  consumed: MacroTotals;
  goal: DailyGoal;
  hasEntries: boolean;
  onTarget: boolean;
}

export interface WeekSummary {
  startDate: string;
  endDate: string;
  days: DailyTotals[];
  averages: MacroTotals;
  daysLogged: number;
  daysOnTarget: number;
}

export interface MonthSummary {
  year: number;
  month: number;
  days: DailyTotals[];
  totals: MacroTotals;
  averages: MacroTotals;
  daysLogged: number;
  daysOnTarget: number;
}

export type DashboardTab = "day" | "week" | "month";

export type AppView =
  | { type: "today" }
  | { type: "goals-settings" }
  | { type: "add-food" }
  | { type: "saved-meals"; tab?: "meals" | "foods" }
  | { type: "new-meal" }
  | { type: "edit-meal"; mealId: string }
  | { type: "new-food" }
  | { type: "edit-food"; foodId: string }
  | { type: "describe-food" }
  | { type: "estimate-review" }
  | { type: "quick-log"; entryId?: string }
  | { type: "log-meal"; mealId: string; entryId?: string }
  | { type: "log-food"; foodId: string }
  | { type: "check-in"; checkInId?: string };
