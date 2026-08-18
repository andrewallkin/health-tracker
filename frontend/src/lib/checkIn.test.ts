import { describe, expect, it } from "vitest";
import {
  formatSevenDayAvgKg,
  formatWeightKg,
  isCheckInValid,
  parseWeightKg,
  sevenDayWeightAverage,
  sevenDayWeightAverageAsOf,
} from "./checkIn";

function row(checkInDate: string, weightKg: number | null) {
  return { checkInDate, weightKg };
}

describe("checkIn validation", () => {
  it("requires at least weight or photos", () => {
    expect(isCheckInValid("", [])).toBe(false);
    expect(isCheckInValid("82", [])).toBe(true);
    expect(isCheckInValid("", ["check-in-photos/u/p.jpg"])).toBe(true);
  });

  it("parses valid weight", () => {
    expect(parseWeightKg("82.5")).toBe(82.5);
    expect(parseWeightKg("82,5")).toBe(82.5);
    expect(parseWeightKg("")).toBeNull();
    expect(parseWeightKg("10")).toBeNull();
  });
});

describe("sevenDayWeightAverage", () => {
  it("averages all seven days when every day has a weight", () => {
    const checkIns = [
      row("2026-08-12", 80),
      row("2026-08-13", 81),
      row("2026-08-14", 82),
      row("2026-08-15", 83),
      row("2026-08-16", 84),
      row("2026-08-17", 85),
      row("2026-08-18", 86),
    ];
    expect(sevenDayWeightAverage("2026-08-18", checkIns)).toEqual({
      averageKg: 83,
      sampleCount: 7,
    });
  });

  it("divides by weigh-in count, not seven, when some days are missing", () => {
    const checkIns = [
      row("2026-08-12", 80),
      row("2026-08-14", 82),
      row("2026-08-16", 84),
      row("2026-08-18", 86),
    ];
    expect(sevenDayWeightAverage("2026-08-18", checkIns)).toEqual({
      averageKg: 83,
      sampleCount: 4,
    });
  });

  it("excludes photo-only days (null weight)", () => {
    const checkIns = [
      row("2026-08-12", 80),
      row("2026-08-13", null),
      row("2026-08-18", 90),
    ];
    expect(sevenDayWeightAverage("2026-08-18", checkIns)).toEqual({
      averageKg: 85,
      sampleCount: 2,
    });
  });

  it("returns null when the window has no weights", () => {
    expect(sevenDayWeightAverage("2026-08-18", [])).toBeNull();
    expect(
      sevenDayWeightAverage("2026-08-18", [row("2026-08-18", null)]),
    ).toBeNull();
  });

  it("computes as-of D even when D has no weigh-in", () => {
    const checkIns = [
      row("2026-08-12", 80),
      row("2026-08-13", 82),
      row("2026-08-14", 84),
    ];
    expect(sevenDayWeightAverage("2026-08-18", checkIns)).toEqual({
      averageKg: 82,
      sampleCount: 3,
    });
  });

  it("ignores weights outside the window, including the next day", () => {
    const checkIns = [
      row("2026-08-11", 50),
      row("2026-08-12", 80),
      row("2026-08-18", 90),
      row("2026-08-19", 200),
    ];
    expect(sevenDayWeightAverage("2026-08-18", checkIns)).toEqual({
      averageKg: 85,
      sampleCount: 2,
    });
  });

  it("uses lookback that crosses a week boundary for Monday", () => {
    const checkIns = [
      row("2026-08-11", 70),
      row("2026-08-12", 72),
      row("2026-08-17", 80),
    ];
    expect(sevenDayWeightAverage("2026-08-17", checkIns)).toEqual({
      averageKg: 74,
      sampleCount: 3,
    });
  });
});

describe("formatSevenDayAvgKg", () => {
  it("formats to two decimal places", () => {
    expect(formatSevenDayAvgKg(83)).toBe("83.00");
    expect(formatSevenDayAvgKg(81.5)).toBe("81.50");
    expect(formatWeightKg(82.7)).toBe("82.70");
  });
});

describe("sevenDayWeightAverageAsOf", () => {
  it("returns null for dates after today", () => {
    const checkIns = [row("2026-08-17", 82), row("2026-08-18", 83)];
    expect(sevenDayWeightAverageAsOf("2026-08-19", checkIns, "2026-08-18")).toBeNull();
  });

  it("computes the average for today and past dates", () => {
    const checkIns = [row("2026-08-17", 82), row("2026-08-18", 84)];
    expect(sevenDayWeightAverageAsOf("2026-08-18", checkIns, "2026-08-18")).toEqual({
      averageKg: 83,
      sampleCount: 2,
    });
  });
});
