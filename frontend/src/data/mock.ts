import type {
  DailyGoal,
  DailySummary,
  LogEntry,
  MacroTotals,
  SavedMeal,
} from "../types/nutrition";

export const dailyGoal: DailyGoal = {
  calories: 2200,
  protein: 180,
  carbs: 220,
  fat: 70,
};

export const initialSavedMeals: SavedMeal[] = [
  {
    id: "meal-1",
    name: "Sweet potato chilli mince",
    description: "Lean beef mince with kidney beans, sweet potato, and spices.",
    imageUrl: "/sweet_potato_chilli_mince.jpg",
    calories: 580,
    protein: 42,
    carbs: 52,
    fat: 22,
  },
  {
    id: "meal-2",
    name: "Protein shake",
    description: "Whey, banana, oat milk.",
    calories: 210,
    protein: 40,
    carbs: 8,
    fat: 3,
  },
  {
    id: "meal-3",
    name: "Chicken stir-fry & rice",
    description: "Chicken thigh, mixed veg, jasmine rice, soy glaze.",
    calories: 620,
    protein: 48,
    carbs: 62,
    fat: 18,
  },
  {
    id: "meal-4",
    name: "Greek yogurt & berries",
    description: "Full-fat yogurt, blueberries, honey drizzle.",
    calories: 320,
    protein: 28,
    carbs: 32,
    fat: 8,
  },
  {
    id: "meal-5",
    name: "Overnight oats",
    description: "Rolled oats, peanut butter, chia seeds, cinnamon.",
    calories: 410,
    protein: 18,
    carbs: 48,
    fat: 16,
  },
  {
    id: "meal-6",
    name: "Tuna salad wrap",
    description: "Wholemeal wrap, tuna, Greek yogurt, cucumber.",
    calories: 380,
    protein: 32,
    carbs: 36,
    fat: 12,
  },
];

export const initialTodayEntries: LogEntry[] = [
  {
    id: "1",
    name: "Greek yogurt & berries",
    slot: "breakfast",
    time: "07:45",
    servings: 1,
    calories: 320,
    protein: 28,
    carbs: 32,
    fat: 8,
    savedMealId: "meal-4",
  },
  {
    id: "2",
    name: "Oat latte",
    slot: "breakfast",
    time: "08:10",
    servings: 1,
    calories: 120,
    protein: 3,
    carbs: 18,
    fat: 4,
  },
  {
    id: "3",
    name: "Sweet potato chilli mince",
    slot: "lunch",
    time: "12:30",
    servings: 1,
    calories: 580,
    protein: 42,
    carbs: 52,
    fat: 22,
    savedMealId: "meal-1",
  },
  {
    id: "4",
    name: "Protein shake",
    slot: "snack",
    time: "15:20",
    servings: 1,
    calories: 210,
    protein: 40,
    carbs: 8,
    fat: 3,
    savedMealId: "meal-2",
  },
  {
    id: "5",
    name: "Chicken stir-fry & rice",
    slot: "dinner",
    time: "19:00",
    servings: 1,
    calories: 620,
    protein: 48,
    carbs: 62,
    fat: 18,
    savedMealId: "meal-3",
  },
  {
    id: "6",
    name: "Dark chocolate",
    slot: "snack",
    time: "21:15",
    servings: 0.5,
    calories: 130,
    protein: 2,
    carbs: 12,
    fat: 9,
  },
];

export function scaleMacros(base: MacroTotals, servings: number): MacroTotals {
  return {
    calories: Math.round(base.calories * servings),
    protein: Math.round(base.protein * servings),
    carbs: Math.round(base.carbs * servings),
    fat: Math.round(base.fat * servings),
  };
}

function sumEntries(entries: LogEntry[]): MacroTotals {
  return entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein: acc.protein + entry.protein,
      carbs: acc.carbs + entry.carbs,
      fat: acc.fat + entry.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function getDailySummary(
  entries: LogEntry[],
  goal: DailyGoal,
): DailySummary {
  const consumed = sumEntries(entries);
  return {
    goal,
    consumed,
    remaining: {
      calories: goal.calories - consumed.calories,
      protein: goal.protein - consumed.protein,
      carbs: goal.carbs - consumed.carbs,
      fat: goal.fat - consumed.fat,
    },
  };
}
