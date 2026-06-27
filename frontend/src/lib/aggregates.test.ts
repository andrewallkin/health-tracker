import { describe, expect, it } from "vitest";

import type { DailyGoal, LogEntry } from "../types/nutrition";
import {
  aggregateMonth,
  aggregateWeek,
  calorieHeatLevel,
  getDailySummary,
  groupEntriesByDate,
  scaleMacros,
  sumEntries,
} from "./aggregates";
import { getWeekDates } from "./dates";

const goal: DailyGoal = { calories: 2000, protein: 150, carbs: 200, fat: 65 };

function entry(partial: Partial<LogEntry> & Pick<LogEntry, "calories">): LogEntry {
  return {
    id: partial.id ?? "e1",
    name: partial.name ?? "Meal",
    slot: partial.slot ?? "lunch",
    time: partial.time ?? "12:00",
    servings: partial.servings ?? 1,
    protein: partial.protein ?? 0,
    carbs: partial.carbs ?? 0,
    fat: partial.fat ?? 0,
    ...partial,
  };
}

describe("sumEntries", () => {
  it("totals macro fields across entries", () => {
    const entries = [
      entry({ calories: 400, protein: 30, carbs: 40, fat: 10 }),
      entry({ id: "e2", calories: 200, protein: 10, carbs: 20, fat: 5 }),
    ];
    expect(sumEntries(entries)).toEqual({
      calories: 600,
      protein: 40,
      carbs: 60,
      fat: 15,
    });
  });
});

describe("scaleMacros", () => {
  it("multiplies and rounds macros by servings", () => {
    expect(scaleMacros({ calories: 400, protein: 30, carbs: 40, fat: 10 }, 2)).toEqual({
      calories: 800,
      protein: 60,
      carbs: 80,
      fat: 20,
    });
  });
});

describe("getDailySummary", () => {
  it("computes remaining budget from goal minus consumed", () => {
    const summary = getDailySummary([entry({ calories: 500, protein: 40 })], goal);
    expect(summary.consumed.calories).toBe(500);
    expect(summary.remaining.calories).toBe(1500);
  });
});

describe("groupEntriesByDate", () => {
  it("buckets entries by logDate and skips missing dates", () => {
    const map = groupEntriesByDate([
      entry({ logDate: "2026-06-01", calories: 100 }),
      entry({ id: "e2", calories: 200 }),
      entry({ id: "e3", logDate: "2026-06-01", calories: 300 }),
    ]);
    expect(map.get("2026-06-01")).toHaveLength(2);
    expect(map.has("2026-06-02")).toBe(false);
  });
});

describe("aggregateWeek", () => {
  it("counts logged and on-target days", () => {
    const dates = getWeekDates("2026-06-24");
    const byDate = groupEntriesByDate([
      entry({ logDate: "2026-06-24", calories: 1800 }),
      entry({ id: "e2", logDate: "2026-06-25", calories: 2500 }),
    ]);
    const week = aggregateWeek(dates, goal, byDate);
    expect(week.daysLogged).toBe(2);
    expect(week.daysOnTarget).toBe(1);
    expect(week.averages.calories).toBe(2150);
  });
});

describe("aggregateMonth", () => {
  it("sums totals for days in the target month", () => {
    const byDate = groupEntriesByDate([
      entry({ logDate: "2026-06-01", calories: 500 }),
      entry({ id: "e2", logDate: "2026-06-15", calories: 600 }),
      entry({ id: "e3", logDate: "2026-07-01", calories: 900 }),
    ]);
    const month = aggregateMonth(2026, 5, goal, byDate);
    expect(month.totals.calories).toBe(1100);
    expect(month.daysLogged).toBe(2);
  });
});

describe("calorieHeatLevel", () => {
  it("classifies consumption relative to goal", () => {
    expect(calorieHeatLevel(0, 2000)).toBe("none");
    expect(calorieHeatLevel(1500, 2000)).toBe("under");
    expect(calorieHeatLevel(2000, 2000)).toBe("near");
    expect(calorieHeatLevel(2500, 2000)).toBe("over");
  });
});
