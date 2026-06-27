import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  addWeeks,
  formatWeekRange,
  getMonthGrid,
  getWeekDates,
  getWeekRange,
  isSameMonth,
  isToday,
  monthFromDateKey,
  parseDateKey,
  toDateKey,
  weekdayShort,
} from "./dates";

describe("toDateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(toDateKey(new Date(2026, 5, 24))).toBe("2026-06-24");
  });
});

describe("parseDateKey", () => {
  it("round-trips with toDateKey", () => {
    const key = "2026-06-24";
    expect(toDateKey(parseDateKey(key))).toBe(key);
  });
});

describe("addDays", () => {
  it("shifts by positive and negative deltas", () => {
    expect(addDays("2026-06-24", 1)).toBe("2026-06-25");
    expect(addDays("2026-06-24", -7)).toBe("2026-06-17");
  });
});

describe("getWeekDates", () => {
  it("returns Monday-start week for a Wednesday", () => {
    expect(getWeekDates("2026-06-24")).toEqual([
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
    ]);
  });
});

describe("getWeekRange", () => {
  it("returns start, end, and all dates", () => {
    const range = getWeekRange("2026-06-24");
    expect(range.start).toBe("2026-06-22");
    expect(range.end).toBe("2026-06-28");
    expect(range.dates).toHaveLength(7);
  });
});

describe("getMonthGrid", () => {
  it("includes padding days to complete full weeks", () => {
    const grid = getMonthGrid(2026, 5);
    expect(grid.length % 7).toBe(0);
    expect(grid.length).toBeGreaterThan(30);
    expect(grid.some((d) => d.startsWith("2026-06-"))).toBe(true);
    expect(grid.some((d) => d.startsWith("2026-07-"))).toBe(true);
  });
});

describe("month helpers", () => {
  it("extracts year and month from a date key", () => {
    expect(monthFromDateKey("2026-06-24")).toEqual({ year: 2026, month: 5 });
  });

  it("adds months and weeks", () => {
    expect(addMonths("2026-06-24", 1)).toBe("2026-07-24");
    expect(addWeeks("2026-06-24", 1)).toBe("2026-07-01");
  });

  it("checks same month", () => {
    expect(isSameMonth("2026-06-24", 2026, 5)).toBe(true);
    expect(isSameMonth("2026-06-24", 2026, 4)).toBe(false);
  });
});

describe("formatWeekRange", () => {
  it("uses compact format when start and end share month", () => {
    expect(formatWeekRange("2026-06-22", "2026-06-28")).toContain("22");
    expect(formatWeekRange("2026-06-22", "2026-06-28")).toContain("28");
  });
});

describe("weekdayShort", () => {
  it("returns short weekday label", () => {
    expect(weekdayShort("2026-06-24")).toBe("Wed");
  });
});

describe("isToday", () => {
  it("matches current date key", () => {
    expect(isToday(toDateKey())).toBe(true);
    expect(isToday("2000-01-01")).toBe(false);
  });
});
