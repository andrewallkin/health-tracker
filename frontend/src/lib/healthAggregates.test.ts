import { describe, expect, it } from "vitest";

import { getMockHealthDay } from "../data/mockHealth";
import { bandFromRatio, bandFromSleepScore } from "./healthColors";
import {
  aggregateHealthMonth,
  aggregateHealthWeek,
  stepHeatLevel,
} from "./healthAggregates";

describe("stepHeatLevel", () => {
  it("classifies step counts relative to goal", () => {
    expect(stepHeatLevel(0, 10000)).toBe("none");
    expect(stepHeatLevel(4000, 10000)).toBe("low");
    expect(stepHeatLevel(7000, 10000)).toBe("mid");
    expect(stepHeatLevel(9000, 10000)).toBe("high");
  });
});

describe("getMockHealthDay", () => {
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

  it("covers varied Garmin HRV statuses across fixtures", () => {
    expect(getMockHealthDay("2026-07-13")!.hrvStatus).toBe("balanced");
    expect(getMockHealthDay("2026-07-14")!.hrvStatus).toBe("unbalanced");
    expect(getMockHealthDay("2026-07-15")!.hrvStatus).toBe("low");
    expect(getMockHealthDay("2026-07-16")!.hrvStatus).toBe("balanced");
  });

  it("covers great/good/fair steps and sleep-score bands across fixtures", () => {
    const d13 = getMockHealthDay("2026-07-13")!;
    const d14 = getMockHealthDay("2026-07-14")!;
    const d15 = getMockHealthDay("2026-07-15")!;

    expect(bandFromRatio(d13.steps, d13.stepGoal)).toBe("great");
    expect(bandFromRatio(d14.steps, d14.stepGoal)).toBe("good");
    expect(bandFromRatio(d15.steps, d15.stepGoal)).toBe("fair");

    expect(bandFromSleepScore(d13.sleepScore!)).toBe("great");
    expect(bandFromSleepScore(d14.sleepScore!)).toBe("good");
    expect(bandFromSleepScore(d15.sleepScore!)).toBe("fair");
  });

  it("maps notebook cardio and trail running onto curated activity types", () => {
    expect(getMockHealthDay("2026-07-16")!.activities[0]?.type).toBe("cardio");
    expect(getMockHealthDay("2026-07-17")!.activities).toEqual([]);
    expect(getMockHealthDay("2026-07-18")!.activities[0]?.type).toBe("running");
  });

  it("returns null for dates outside the fixture set", () => {
    expect(getMockHealthDay("2026-07-12")).toBeNull();
  });

  it("sorts activities ascending by start time in fixtures", () => {
    const day = getMockHealthDay("2026-07-13");
    const starts = day!.activities.map((a) => a.startTime);
    expect(starts).toEqual([...starts].sort());
  });
});

describe("aggregateHealthWeek", () => {
  it("averages only fixture days and excludes nulls", () => {
    // Week Mon 13 – Sun 19 Jul 2026; fixtures on 13–18
    const recorded = [
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
    ]
      .map((date) => getMockHealthDay(date))
      .filter((day) => day !== null);
    const summary = aggregateHealthWeek("2026-07-15", recorded);

    expect(summary.days).toHaveLength(7);
    expect(summary.avgSteps).toBe(6862);
    expect(summary.avgSleepHours).toBe(7);
    expect(summary.avgSleepScore).toBe(76);
    expect(summary.avgTotalCalories).toBe(2778);
    expect(summary.avgBmrCalories).toBe(2012);
    expect(summary.avgActiveCalories).toBe(766);
    expect(summary.avgRestingHr).toBe(49);
    expect(summary.avgHrv).toBe(89);
    expect(summary.stepGoalDays).toBe(2); // 13, 16
    expect(summary.totalActivities).toBe(6);
    expect(summary.totalWorkoutMin).toBe(312);
  });

  it("returns null averages when the week has no fixture days", () => {
    const summary = aggregateHealthWeek("2026-06-01", []);
    expect(summary.avgSteps).toBe(0);
    expect(summary.avgSleepScore).toBeNull();
    expect(summary.avgRestingHr).toBeNull();
    expect(summary.avgHrv).toBeNull();
    expect(summary.avgTotalCalories).toBe(0);
    expect(summary.avgBmrCalories).toBe(0);
    expect(summary.totalActivities).toBe(0);
  });
});

describe("aggregateHealthMonth", () => {
  it("averages only in-month fixture days and excludes nulls", () => {
    // July 2026 fixtures: 13–18
    const recorded = [
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
    ]
      .map((date) => getMockHealthDay(date))
      .filter((day) => day !== null);
    const summary = aggregateHealthMonth("2026-07-15", recorded);

    expect(summary.year).toBe(2026);
    expect(summary.month).toBe(6); // 0-indexed July
    expect(summary.totalSteps).toBe(27448);
    expect(summary.avgSteps).toBe(6862);
    expect(summary.avgSleepHours).toBe(7);
    expect(summary.avgSleepScore).toBe(76);
    expect(summary.avgTotalCalories).toBe(2778);
    expect(summary.avgBmrCalories).toBe(2012);
    expect(summary.avgActiveCalories).toBe(766);
    expect(summary.avgRestingHr).toBe(49);
    expect(summary.avgHrv).toBe(89);
    expect(summary.stepGoalDays).toBe(2);
    expect(summary.totalActivities).toBe(6);
    expect(summary.totalWorkoutMin).toBe(312);
    expect(summary.activityByType.strength_training).toBe(3);
    expect(summary.activityByType.running).toBe(2);
    expect(summary.activityByType.cardio).toBe(1);
    expect(summary.activityByType.walking).toBe(0);
  });

  it("returns null averages when the month has no fixture days", () => {
    const summary = aggregateHealthMonth("2026-06-15", []);
    expect(summary.avgSteps).toBe(0);
    expect(summary.totalSteps).toBe(0);
    expect(summary.avgSleepScore).toBeNull();
    expect(summary.avgRestingHr).toBeNull();
    expect(summary.avgHrv).toBeNull();
    expect(summary.avgTotalCalories).toBe(0);
    expect(summary.totalActivities).toBe(0);
    expect(summary.totalWorkoutMin).toBe(0);
  });
});
