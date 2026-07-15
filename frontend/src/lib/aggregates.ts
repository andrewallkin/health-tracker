import type {
  DailyGoal,
  DailySummary,
  DailyTotals,
  LogEntry,
  MacroTotals,
  MonthSummary,
  WeekSummary,
} from "../types/nutrition";
import { getMonthGrid } from "./dates";

export function sumEntries(entries: LogEntry[]): MacroTotals {
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

export function scaleMacros(base: MacroTotals, servings: number): MacroTotals {
  return {
    calories: Math.round(base.calories * servings),
    protein: Math.round(base.protein * servings),
    carbs: Math.round(base.carbs * servings),
    fat: Math.round(base.fat * servings),
  };
}

export function getDailySummary(entries: LogEntry[], goal: DailyGoal): DailySummary {
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

function isOnTarget(consumed: MacroTotals, goal: DailyGoal): boolean {
  return consumed.calories > 0 && consumed.calories <= goal.calories;
}

function averageTotals(days: DailyTotals[]): MacroTotals {
  if (days.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const counted = days.filter((d) => d.countsInAverages);
  if (counted.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const sum = counted.reduce(
    (acc, day) => ({
      calories: acc.calories + day.consumed.calories,
      protein: acc.protein + day.consumed.protein,
      carbs: acc.carbs + day.consumed.carbs,
      fat: acc.fat + day.consumed.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    calories: Math.round(sum.calories / counted.length),
    protein: Math.round(sum.protein / counted.length),
    carbs: Math.round(sum.carbs / counted.length),
    fat: Math.round(sum.fat / counted.length),
  };
}

export function groupEntriesByDate(entries: LogEntry[]): Map<string, LogEntry[]> {
  const map = new Map<string, LogEntry[]>();
  for (const entry of entries) {
    if (!entry.logDate) continue;
    const bucket = map.get(entry.logDate) ?? [];
    bucket.push(entry);
    map.set(entry.logDate, bucket);
  }
  return map;
}

export function getDailyTotals(
  dateKey: string,
  goal: DailyGoal,
  entries: LogEntry[],
  manuallyNotTracked = false,
): DailyTotals {
  const consumed = sumEntries(entries);
  const hasEntries = entries.length > 0;
  return {
    date: dateKey,
    consumed,
    goal,
    hasEntries,
    onTarget: isOnTarget(consumed, goal),
    notTracked: !hasEntries || manuallyNotTracked,
    countsInAverages: hasEntries && !manuallyNotTracked,
  };
}

export function aggregateWeek(
  dates: string[],
  goal: DailyGoal,
  entriesByDate: Map<string, LogEntry[]>,
  notTrackedDates: ReadonlySet<string> = new Set(),
): WeekSummary {
  const days = dates.map((date) =>
    getDailyTotals(date, goal, entriesByDate.get(date) ?? [], notTrackedDates.has(date)),
  );
  const counted = days.filter((d) => d.countsInAverages);
  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    days,
    averages: averageTotals(days),
    daysLogged: counted.length,
    daysOnTarget: counted.filter((d) => d.onTarget).length,
  };
}

export function aggregateMonth(
  year: number,
  month: number,
  goal: DailyGoal,
  entriesByDate: Map<string, LogEntry[]>,
  notTrackedDates: ReadonlySet<string> = new Set(),
): MonthSummary {
  const gridDates = getMonthGrid(year, month);
  const days = gridDates.map((date) =>
    getDailyTotals(date, goal, entriesByDate.get(date) ?? [], notTrackedDates.has(date)),
  );
  const inMonth = days.filter((d) => {
    const [y, m] = d.date.split("-").map(Number);
    return y === year && m - 1 === month;
  });
  const counted = inMonth.filter((d) => d.countsInAverages);

  const totals = counted.reduce(
    (acc, day) => ({
      calories: acc.calories + day.consumed.calories,
      protein: acc.protein + day.consumed.protein,
      carbs: acc.carbs + day.consumed.carbs,
      fat: acc.fat + day.consumed.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    year,
    month,
    days,
    totals,
    averages: averageTotals(inMonth),
    daysLogged: counted.length,
    daysOnTarget: counted.filter((d) => d.onTarget).length,
  };
}

export function calorieHeatLevel(consumed: number, goal: number): "none" | "under" | "near" | "over" {
  if (consumed <= 0) return "none";
  const ratio = consumed / goal;
  if (ratio <= 0.85) return "under";
  if (ratio <= 1.1) return "near";
  return "over";
}
