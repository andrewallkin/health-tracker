import { describe, expect, it } from "vitest";

import { getMockHealthDay } from "../data/mockHealth";
import { getHealthDay, stepHeatLevel } from "./healthAggregates";

describe("stepHeatLevel", () => {
  it("classifies step counts relative to goal", () => {
    expect(stepHeatLevel(0, 10000)).toBe("none");
    expect(stepHeatLevel(4000, 10000)).toBe("low");
    expect(stepHeatLevel(7000, 10000)).toBe("mid");
    expect(stepHeatLevel(9000, 10000)).toBe("high");
  });
});

describe("getMockHealthDay / getHealthDay", () => {
  it("returns fixture data for the demo days", () => {
    const day = getMockHealthDay("2026-07-13");
    expect(day).not.toBeNull();
    expect(day!.sleepHours).toBeGreaterThan(0);
    expect(day!.remSleepHours).toBeDefined();
    expect(day!.lightSleepHours).toBeDefined();
    expect(day!.minHr).toBeDefined();
    expect(day!.maxHr).toBeDefined();
    expect(day!.avgRestingHr7d).toBeDefined();
    expect(day!.hrvWeeklyAvg).toBeDefined();
    expect(day!.activities.length).toBeGreaterThan(0);
  });

  it("covers each Garmin HRV status across fixtures", () => {
    expect(getMockHealthDay("2026-07-13")!.hrvStatus).toBe("balanced");
    expect(getMockHealthDay("2026-07-14")!.hrvStatus).toBe("unbalanced");
    expect(getMockHealthDay("2026-07-15")!.hrvStatus).toBe("low");
    expect(getMockHealthDay("2026-07-16")!.hrvStatus).toBe("poor");
  });

  it("returns null for dates outside the fixture set", () => {
    expect(getMockHealthDay("2026-07-12")).toBeNull();
    expect(getHealthDay("2026-07-17")).toBeNull();
  });

  it("sorts activities ascending by start time in fixtures", () => {
    const day = getMockHealthDay("2026-07-13");
    const starts = day!.activities.map((a) => a.startTime);
    expect(starts).toEqual([...starts].sort());
  });
});
