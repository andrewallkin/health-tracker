import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  checkInDayDeltaFetchRange,
  checkInMonthFetchRange,
  checkInWeekFetchRange,
  clampDatesFrom,
  firstWeightedDate,
  formatSevenDayAvgKg,
  formatSignedKg,
  formatWeightKg,
  isCheckInValid,
  parseWeightKg,
  rollingAverageDeltas,
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

describe("checkInWeekFetchRange", () => {
  it("extends back for rolling 7-day averages and forward to today when viewing a past week", () => {
    expect(checkInWeekFetchRange("2026-08-17", "2026-08-23", "2026-09-01")).toEqual({
      from: "2026-08-11",
      to: "2026-09-01",
    });
  });

  it("uses week start minus 6 when that is earlier than the rolling lookback", () => {
    expect(checkInWeekFetchRange("2026-08-10", "2026-08-16", "2026-09-01")).toEqual({
      from: "2026-08-04",
      to: "2026-09-01",
    });
  });

  it("keeps through Sunday when the viewed week is still in progress", () => {
    expect(checkInWeekFetchRange("2026-08-31", "2026-09-06", "2026-09-01")).toEqual({
      from: "2026-08-20",
      to: "2026-09-06",
    });
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

describe("firstWeightedDate", () => {
  it("returns the earliest date with a non-null weight", () => {
    expect(
      firstWeightedDate([
        row("2026-09-04", null),
        row("2026-09-06", 82),
        row("2026-09-02", 80),
      ]),
    ).toBe("2026-09-02");
  });

  it("returns null when there are no weights", () => {
    expect(firstWeightedDate([row("2026-09-02", null)])).toBeNull();
  });
});

describe("clampDatesFrom", () => {
  it("drops dates before earliest and keeps the rest", () => {
    expect(clampDatesFrom(["2026-09-01", "2026-09-02", "2026-09-03"], "2026-09-02")).toEqual([
      "2026-09-02",
      "2026-09-03",
    ]);
  });

  it("returns the original list when earliest is null", () => {
    expect(clampDatesFrom(["2026-09-01"], null)).toEqual(["2026-09-01"]);
  });
});

describe("checkInMonthFetchRange", () => {
  it("extends back for rolling 30-day averages and forward to today when viewing a past month", () => {
    expect(checkInMonthFetchRange("2026-07-01", "2026-07-31", "2026-09-08")).toEqual({
      from: "2026-06-25",
      to: "2026-09-08",
    });
  });

  it("uses today minus 35 when that is earlier than month start minus 6", () => {
    expect(checkInMonthFetchRange("2026-09-01", "2026-09-30", "2026-09-08")).toEqual({
      from: "2026-08-04",
      to: "2026-09-30",
    });
  });
});

describe("checkInDayDeltaFetchRange", () => {
  it("looks back 36 days so a 30-day delta has a 7-day average window", () => {
    expect(checkInDayDeltaFetchRange("2026-09-08")).toEqual({
      from: "2026-08-03",
      to: "2026-09-08",
    });
  });
});

describe("formatSignedKg", () => {
  it("signs positive, negative, and zero values", () => {
    expect(formatSignedKg(0.32)).toBe("+0.32 kg");
    expect(formatSignedKg(-0.32)).toBe("−0.32 kg");
    expect(formatSignedKg(0)).toBe("0.00 kg");
  });
});

describe("rollingAverageDeltas", () => {
  const today = "2026-09-08";
  const daily = Array.from({ length: 40 }, (_, i) =>
    row(addDays(today, i - 39), 80 + i * 0.1),
  );

  it("uses full period labels when history covers the window", () => {
    const deltas = rollingAverageDeltas(today, daily, today);
    expect(deltas[0]?.label).toBe("1 day");
    expect(deltas[1]?.label).toBe("7 days");
    expect(deltas[2]?.label).toBe("14 days");
    expect(deltas[3]?.label).toBe("1 month");
    expect(deltas[0]?.deltaKg).toBeCloseTo(
      sevenDayWeightAverage(today, daily)!.averageKg -
        sevenDayWeightAverage(addDays(today, -1), daily)!.averageKg,
    );
    expect(deltas[3]?.startDate).toBe(addDays(today, -30));
  });

  it("clamps to the first weighted day and relabels the span", () => {
    const short = [
      row("2026-08-27", 84),
      row("2026-09-01", 83),
      row("2026-09-08", 82),
    ];
    const deltas = rollingAverageDeltas("2026-09-08", short, "2026-09-08");
    expect(deltas[3]?.label).toBe("12 days");
    expect(deltas[3]?.startDate).toBe("2026-08-27");
    expect(deltas[3]?.deltaKg).toBeCloseTo(
      sevenDayWeightAverage("2026-09-08", short)!.averageKg -
        sevenDayWeightAverage("2026-08-27", short)!.averageKg,
    );
  });

  it("returns null for a period when start would be the as-of date", () => {
    const oneDay = [row("2026-09-08", 82)];
    const deltas = rollingAverageDeltas("2026-09-08", oneDay, "2026-09-08");
    expect(deltas.every((delta) => delta === null)).toBe(true);
  });

  it("keeps unclamped labels for shorter periods", () => {
    const short = [
      row("2026-08-27", 84),
      row("2026-09-01", 83),
      row("2026-09-08", 82),
    ];
    const deltas = rollingAverageDeltas("2026-09-08", short, "2026-09-08");
    expect(deltas[0]?.label).toBe("1 day");
    expect(deltas[3]?.label).toBe("12 days");
  });
});
