import { describe, expect, it } from "vitest";

import { getMockHealthDay } from "../data/mockHealth";
import { bandFromRatio, bandFromSleepScore } from "./healthColors";
import {
  aggregateHealthMonth,
  aggregateHealthWeek,
  getHealthDay,
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
    expect(getHealthDay("2026-07-19")).toBeNull();
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
    const summary = aggregateHealthWeek("2026-07-15");

    expect(summary.days).toHaveLength(7);
    expect(summary.avgSteps).toBe(7891); // round((10100+6000+4200+7148+4353+15544)/6)
    expect(summary.avgSleepHours).toBe(7.1); // round(((7.7+7.5+6.4+6.3+7+7.7)/6)*10)/10
    expect(summary.avgSleepScore).toBe(77); // round((86+74+65+77+79+79)/6)
    expect(summary.avgTotalCalories).toBe(2594); // round((3074+3082+2003+2952+2275+2178)/6)
    expect(summary.avgBmrCalories).toBe(1900); // round((2185+2185+1493+2185+2185+1169)/6)
    expect(summary.avgActiveCalories).toBe(694); // round((889+897+510+767+90+1009)/6)
    expect(summary.avgRestingHr).toBe(49); // round((47+48+50+49+50+49)/6)
    expect(summary.avgHrv).toBe(90); // round((103+92+68+91+93+91)/6)
    expect(summary.stepGoalDays).toBe(3); // 13, 16, 18
    expect(summary.totalActivities).toBe(7);
    expect(summary.totalWorkoutMin).toBe(400);
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

describe("aggregateHealthMonth", () => {
  it("averages only in-month fixture days and excludes nulls", () => {
    // July 2026 fixtures: 13–18
    const summary = aggregateHealthMonth("2026-07-15");

    expect(summary.year).toBe(2026);
    expect(summary.month).toBe(6); // 0-indexed July
    expect(summary.totalSteps).toBe(47345);
    expect(summary.avgSteps).toBe(7891);
    expect(summary.avgSleepHours).toBe(7.1);
    expect(summary.avgSleepScore).toBe(77);
    expect(summary.avgTotalCalories).toBe(2594);
    expect(summary.avgBmrCalories).toBe(1900);
    expect(summary.avgActiveCalories).toBe(694);
    expect(summary.avgRestingHr).toBe(49);
    expect(summary.avgHrv).toBe(90);
    expect(summary.stepGoalDays).toBe(3);
    expect(summary.totalActivities).toBe(7);
    expect(summary.totalWorkoutMin).toBe(400);
    expect(summary.activityByType.strength_training).toBe(3);
    expect(summary.activityByType.running).toBe(3); // includes trail_running → running
    expect(summary.activityByType.cardio).toBe(1);
    expect(summary.activityByType.walking).toBe(0);
  });

  it("returns null averages when the month has no fixture days", () => {
    const summary = aggregateHealthMonth("2026-06-15");
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
