import { describe, expect, it } from "vitest";
import { dayEnergyBalance, rangeEnergyBalance } from "./energyBalance";
import type { DailyGoal, DailyTotals } from "../types/nutrition";

const goal: DailyGoal = { calories: 2000, protein: 150, carbs: 200, fat: 60 };

function day(
  date: string,
  calories: number,
  opts: { countsInAverages?: boolean } = {},
): DailyTotals {
  const countsInAverages = opts.countsInAverages ?? true;
  return {
    date,
    consumed: { calories, protein: 0, carbs: 0, fat: 0 },
    goal,
    hasEntries: countsInAverages,
    onTarget: calories <= goal.calories,
    notTracked: !countsInAverages,
    countsInAverages,
  };
}

const idle = { loading: false, garminDisconnected: false, loadError: null };

describe("dayEnergyBalance", () => {
  it("returns loading while fetch in flight", () => {
    expect(
      dayEnergyBalance(1800, 2200, { loading: true, garminDisconnected: false, loadError: null }),
    ).toEqual({ status: "loading" });
  });

  it("returns disconnected when Garmin 503", () => {
    expect(
      dayEnergyBalance(1800, null, {
        loading: false,
        garminDisconnected: true,
        loadError: "Connect Garmin",
      }),
    ).toEqual({ status: "unavailable", reason: "disconnected" });
  });

  it("returns error when load failed", () => {
    expect(
      dayEnergyBalance(1800, null, {
        loading: false,
        garminDisconnected: false,
        loadError: "boom",
      }),
    ).toEqual({ status: "unavailable", reason: "error" });
  });

  it("returns missing when burn absent", () => {
    expect(dayEnergyBalance(1800, null, idle)).toEqual({
      status: "unavailable",
      reason: "missing",
    });
  });

  it("treats zero burn as ready", () => {
    expect(dayEnergyBalance(1800, 0, idle)).toEqual({
      status: "ready",
      eaten: 1800,
      burned: 0,
      net: 1800,
    });
  });

  it("computes deficit net", () => {
    expect(dayEnergyBalance(1800, 2200, idle)).toEqual({
      status: "ready",
      eaten: 1800,
      burned: 2200,
      net: -400,
    });
  });
});

describe("rangeEnergyBalance", () => {
  it("returns loading while fetch in flight", () => {
    expect(
      rangeEnergyBalance([], new Map(), {
        loading: true,
        garminDisconnected: false,
        loadError: null,
      }),
    ).toEqual({ status: "loading" });
  });

  it("averages only intersection of countable food and present burn", () => {
    const days = [
      day("2026-07-13", 2000),
      day("2026-07-14", 2200),
      day("2026-07-15", 1800, { countsInAverages: false }),
      day("2026-07-16", 1900),
    ];
    const burns = new Map<string, number | null>([
      ["2026-07-13", 2400],
      ["2026-07-14", null],
      ["2026-07-15", 2500],
      ["2026-07-16", 2100],
    ]);
    expect(rangeEnergyBalance(days, burns, idle)).toEqual({
      status: "ready",
      eaten: 1950,
      burned: 2250,
      net: -300,
      daysUsed: 2,
    });
  });

  it("returns missing when intersection empty", () => {
    const days = [day("2026-07-13", 2000)];
    const burns = new Map<string, number | null>([["2026-07-13", null]]);
    expect(rangeEnergyBalance(days, burns, idle)).toEqual({
      status: "unavailable",
      reason: "missing",
    });
  });

  it("returns disconnected over missing when Garmin down", () => {
    expect(
      rangeEnergyBalance([day("2026-07-13", 2000)], new Map(), {
        loading: false,
        garminDisconnected: true,
        loadError: "Connect Garmin",
      }),
    ).toEqual({ status: "unavailable", reason: "disconnected" });
  });
});
