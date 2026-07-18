import { addDays, toDateKey } from "../lib/dates";
import { mapGarminActivityType } from "../lib/garminActivityType";
import type {
  ActivityType,
  DailyHealth,
  HrvStatus,
} from "../types/health";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  strength_training: "Strength",
  running: "Run",
  cycling: "Ride",
  walking: "Walk",
  hiking: "Hike",
  cardio: "Cardio",
  other: "Other",
};

export const ACTIVITY_TYPE_EMOJI: Record<ActivityType, string> = {
  strength_training: "🏋️",
  running: "🏃",
  cycling: "🚴",
  walking: "🚶",
  hiking: "🥾",
  cardio: "💓",
  other: "🏋️",
};

export const HRV_STATUS_LABELS: Record<HrvStatus, string> = {
  balanced: "Balanced",
  unbalanced: "Unbalanced",
  low: "Low",
  poor: "Poor",
  unavailable: "No data",
};

export const HRV_STATUS_EMOJI: Record<HrvStatus, string> = {
  balanced: "✅",
  unbalanced: "⚠️",
  low: "⬇️",
  poor: "❌",
  unavailable: "❔",
};

/** Tailwind text accent class for HRV status. */
export function hrvStatusAccent(status: HrvStatus): string {
  if (status === "balanced") return "text-emerald-400";
  if (status === "unbalanced") return "text-amber-400";
  if (status === "low") return "text-orange-400";
  if (status === "poor") return "text-rose-400";
  return "text-zinc-400";
}

const FIXTURES: Record<string, DailyHealth> = {
  "2026-07-13": {
    date: "2026-07-13",
    steps: 10100,
    stepGoal: 7000,
    totalCalories: 3074,
    activeCalories: 889,
    bmrCalories: 2185,
    restingHr: 47,
    minHr: 46,
    maxHr: 192,
    avgRestingHr7d: 48,
    sleepHours: 7.7,
    deepSleepHours: 1.5,
    remSleepHours: 0.9,
    lightSleepHours: 5.3,
    sleepAvgHr: 53,
    sleepScore: 86,
    hrv: 103,
    hrvStatus: "balanced",
    hrvWeeklyAvg: 93,
    activities: [
      {
        id: "2026-07-13-0",
        name: "Strength",
        type: "strength_training",
        startTime: "06:51",
        durationMin: 67,
        calories: 484,
        avgHr: 118,
      },
      {
        id: "2026-07-13-1",
        name: "Cape Town Running",
        type: "running",
        startTime: "17:27",
        durationMin: 30,
        calories: 387,
        avgHr: 153,
        distanceKm: 5.01,
      },
    ],
  },
  "2026-07-14": {
    date: "2026-07-14",
    steps: 6000,
    stepGoal: 7000,
    totalCalories: 3082,
    activeCalories: 897,
    bmrCalories: 2185,
    restingHr: 48,
    minHr: 46,
    maxHr: 194,
    avgRestingHr7d: 48,
    sleepHours: 7.5,
    deepSleepHours: 1.4,
    remSleepHours: 1.7,
    lightSleepHours: 4.5,
    sleepAvgHr: 52,
    sleepScore: 74,
    hrv: 92,
    hrvStatus: "unbalanced",
    hrvWeeklyAvg: 92,
    activities: [
      {
        id: "2026-07-14-0",
        name: "Strength",
        type: "strength_training",
        startTime: "11:20",
        durationMin: 58,
        calories: 402,
        avgHr: 115,
      },
      {
        id: "2026-07-14-1",
        name: "Cape Town Running",
        type: "running",
        startTime: "17:37",
        durationMin: 28,
        calories: 392,
        avgHr: 165,
        distanceKm: 5.02,
      },
    ],
  },
  "2026-07-15": {
    date: "2026-07-15",
    steps: 4200,
    stepGoal: 7000,
    totalCalories: 2003,
    activeCalories: 510,
    bmrCalories: 1493,
    restingHr: 50,
    minHr: 47,
    maxHr: 146,
    avgRestingHr7d: 48,
    sleepHours: 6.4,
    deepSleepHours: 1.2,
    remSleepHours: 0.9,
    lightSleepHours: 4.3,
    sleepAvgHr: 53,
    sleepScore: 65,
    hrv: 68,
    hrvStatus: "low",
    hrvWeeklyAvg: 91,
    activities: [
      {
        id: "2026-07-15-0",
        name: "Strength",
        type: "strength_training",
        startTime: "06:48",
        durationMin: 66,
        calories: 510,
        avgHr: 124,
      },
    ],
  },
  "2026-07-16": {
    date: "2026-07-16",
    steps: 7148,
    stepGoal: 7000,
    totalCalories: 2952,
    activeCalories: 767,
    bmrCalories: 2185,
    restingHr: 49,
    minHr: 45,
    maxHr: 176,
    avgRestingHr7d: 49,
    sleepHours: 6.3,
    deepSleepHours: 1.4,
    remSleepHours: 1.0,
    lightSleepHours: 3.8,
    sleepAvgHr: 53,
    sleepScore: 77,
    hrv: 91,
    hrvStatus: "balanced",
    hrvWeeklyAvg: 90,
    activities: [
      {
        id: "2026-07-16-0",
        name: "Cardio",
        type: mapGarminActivityType("indoor_cardio"),
        startTime: "06:50",
        durationMin: 63,
        calories: 720,
        avgHr: 151,
      },
    ],
  },
  "2026-07-17": {
    date: "2026-07-17",
    steps: 4353,
    stepGoal: 7000,
    totalCalories: 2275,
    activeCalories: 90,
    bmrCalories: 2185,
    restingHr: 50,
    minHr: 46,
    maxHr: 104,
    avgRestingHr7d: 49,
    sleepHours: 7.0,
    deepSleepHours: 1.5,
    remSleepHours: 1.2,
    lightSleepHours: 4.3,
    sleepAvgHr: 53,
    sleepScore: 79,
    hrv: 93,
    hrvStatus: "balanced",
    hrvWeeklyAvg: 91,
    activities: [],
  },
  "2026-07-18": {
    date: "2026-07-18",
    steps: 15544,
    stepGoal: 7000,
    totalCalories: 2178,
    activeCalories: 1009,
    bmrCalories: 1169,
    restingHr: 49,
    minHr: 46,
    maxHr: 172,
    avgRestingHr7d: 49,
    sleepHours: 7.7,
    deepSleepHours: 1.7,
    remSleepHours: 1.7,
    lightSleepHours: 4.3,
    sleepAvgHr: 53,
    sleepScore: 79,
    hrv: 91,
    hrvStatus: "balanced",
    hrvWeeklyAvg: 90,
    activities: [
      {
        id: "2026-07-18-0",
        name: "Cape Town Trail Running",
        type: mapGarminActivityType("trail_running"),
        startTime: "09:09",
        durationMin: 88,
        calories: 1006,
        avgHr: 153,
        distanceKm: 10.92,
      },
    ],
  },
};

export function emptyHealthDay(dateKey: string): DailyHealth {
  return {
    date: dateKey,
    steps: 0,
    stepGoal: 7000,
    totalCalories: 0,
    activeCalories: 0,
    bmrCalories: 0,
    restingHr: 0,
    minHr: 0,
    maxHr: 0,
    avgRestingHr7d: 0,
    sleepHours: 0,
    deepSleepHours: 0,
    remSleepHours: 0,
    lightSleepHours: 0,
    sleepAvgHr: 0,
    sleepScore: null,
    hrv: null,
    hrvStatus: "unavailable",
    hrvWeeklyAvg: null,
    activities: [],
  };
}

export function getMockHealthDay(dateKey: string): DailyHealth | null {
  return FIXTURES[dateKey] ?? null;
}

/** Pre-generate mock data for a date range (inclusive). Missing days use empty stubs. */
export function getMockHealthRange(startKey: string, endKey: string): DailyHealth[] {
  const days: DailyHealth[] = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    days.push(getMockHealthDay(cursor) ?? emptyHealthDay(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function getMockHealthToday(): DailyHealth | null {
  return getMockHealthDay(toDateKey());
}
