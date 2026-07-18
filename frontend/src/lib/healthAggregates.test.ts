import { describe, expect, it } from "vitest";

import { getMockHealthDay } from "../data/mockHealth";
import { bandFromRatio, bandFromSleepScore } from "./healthColors";
import { aggregateHealthWeek, getHealthDay, stepHeatLevel } from "./healthAggregates";

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

  it("covers each steps and sleep-score band across fixtures", () => {
    const d13 = getMockHealthDay("2026-07-13")!;
    const d14 = getMockHealthDay("2026-07-14")!;
    const d15 = getMockHealthDay("2026-07-15")!;
    const d16 = getMockHealthDay("2026-07-16")!;

    expect(bandFromRatio(d13.steps, d13.stepGoal)).toBe("great");
    expect(bandFromRatio(d14.steps, d14.stepGoal)).toBe("good");
    expect(bandFromRatio(d15.steps, d15.stepGoal)).toBe("fair");
    expect(bandFromRatio(d16.steps, d16.stepGoal)).toBe("poor");

    expect(bandFromSleepScore(d13.sleepScore!)).toBe("great");
    expect(bandFromSleepScore(d14.sleepScore!)).toBe("good");
    expect(bandFromSleepScore(d15.sleepScore!)).toBe("fair");
    expect(bandFromSleepScore(d16.sleepScore!)).toBe("poor");
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

describe("aggregateHealthWeek", () => {
  it("averages only fixture days and excludes nulls", () => {
    // Week Mon 13 – Sun 19 Jul 2026; fixtures on 13–16 only
    const summary = aggregateHealthWeek("2026-07-15");

    expect(summary.days).toHaveLength(7);
    expect(summary.avgSteps).toBe(5775); // round((10100+6000+4200+2800)/4)
    expect(summary.avgSleepHours).toBe(6.7); // round(((7.7+7.5+6.4+5.2)/4)*10)/10
    expect(summary.avgSleepScore).toBe(68); // round((86+74+65+48)/4)
    expect(summary.avgTotalCalories).toBe(2577); // round((3074+3082+2003+2150)/4)
    expect(summary.avgBmrCalories).toBe(1898); // round((2185+2185+1493+1730)/4)
    expect(summary.avgActiveCalories).toBe(679); // round((889+897+510+420)/4)
    expect(summary.avgRestingHr).toBe(50); // round((47+48+50+54)/4)
    expect(summary.avgHrv).toBe(79); // round((103+92+68+52)/4)
    expect(summary.stepGoalDays).toBe(1); // only 13 hits goal
    expect(summary.totalActivities).toBe(6);
    expect(summary.totalWorkoutMin).toBe(284);
  });

  it("returns null averages when the week has no fixture days", () => {
    const summary = aggregateHealthWeek("2026-06-01");
    expect(summary.avgSteps).toBe(0);
    expect(summary.avgSleepScore).toBeNull();
    expect(summary.avgRestingHr).toBeNull();
    expect(summary.avgHrv).toBeNull();
    expect(summary.avgTotalCalories).toBe(0);
    expect(summary.avgBmrCalories).toBe(0);
    expect(summary.totalActivities).toBe(0);
  });
});
