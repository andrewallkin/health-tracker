import { addDays, toDateKey } from "../lib/dates";
import type {
  ActivityType,
  DailyHealth,
  HealthActivity,
  HrvStatus,
} from "../types/health";

const STEP_GOAL = 10_000;

const ACTIVITY_TEMPLATES: Omit<HealthActivity, "id" | "startTime">[] = [
  {
    name: "Strength",
    type: "strength_training",
    durationMin: 68,
    calories: 492,
    avgHr: 119,
  },
  {
    name: "Morning run",
    type: "running",
    durationMin: 42,
    calories: 410,
    avgHr: 152,
    distanceKm: 7.2,
  },
  {
    name: "Evening walk",
    type: "walking",
    durationMin: 35,
    calories: 145,
    avgHr: 98,
    distanceKm: 3.1,
  },
  {
    name: "Indoor ride",
    type: "cycling",
    durationMin: 55,
    calories: 520,
    avgHr: 138,
    distanceKm: 22.4,
  },
  {
    name: "Trail hike",
    type: "hiking",
    durationMin: 95,
    calories: 680,
    avgHr: 112,
    distanceKm: 8.5,
  },
];

function seed(dateKey: string): number {
  const parts = dateKey.split("-").map(Number);
  return (parts[0] * 397 + parts[1] * 53 + parts[2] * 17) % 1000;
}

function pick<T>(items: T[], s: number, offset = 0): T {
  return items[(s + offset) % items.length];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildCurve(s: number, base: number, amplitude: number, points = 24): number[] {
  return Array.from({ length: points }, (_, hour) => {
    const wave = Math.sin(((hour + s % 7) / 24) * Math.PI * 2) * amplitude;
    const dip = hour >= 23 || hour <= 6 ? -amplitude * 0.6 : 0;
    return clamp(Math.round(base + wave + dip), 0, 100);
  });
}

function hrvStatus(hrv: number | null): HrvStatus {
  if (hrv === null) return "unavailable";
  if (hrv < 38) return "low";
  if (hrv > 52) return "high";
  return "balanced";
}

function buildActivities(s: number, activeCalories: number): HealthActivity[] {
  if (s % 5 === 0) return [];

  const count = s % 7 === 0 ? 2 : 1;
  const activities: HealthActivity[] = [];

  for (let i = 0; i < count; i += 1) {
    const template = pick(ACTIVITY_TEMPLATES, s, i * 3);
    const hour = 6 + ((s + i * 4) % 12);
    activities.push({
      ...template,
      id: `${s}-${i}`,
      startTime: `${String(hour).padStart(2, "0")}:${String((s * 7 + i * 13) % 60).padStart(2, "0")}`,
      calories: Math.round(template.calories * (0.85 + (s % 20) / 100)),
      durationMin: Math.round(template.durationMin * (0.9 + (s % 15) / 100)),
      avgHr: template.avgHr + (s % 5) - 2,
    });
  }

  if (activeCalories < 250 && activities.length > 1) {
    return activities.slice(0, 1);
  }

  return activities;
}

export function getMockHealthDay(dateKey: string): DailyHealth {
  const s = seed(dateKey);
  const isWeekend = [0, 6].includes(new Date(`${dateKey}T12:00:00`).getDay());

  const steps = clamp(
    Math.round(4_200 + (s % 17) * 420 + (isWeekend ? 1_800 : 0) + (s % 3 === 0 ? 900 : 0)),
    1_500,
    18_500,
  );
  const activeCalories = clamp(Math.round(steps * 0.028 + (s % 9) * 35 + (s % 4) * 80), 180, 980);
  const bmrCalories = 1_720;
  const totalCalories = bmrCalories + activeCalories + Math.round((s % 11) * 8);

  const sleepHours = clamp(5.8 + (s % 13) * 0.22 + (s % 6 === 0 ? -0.8 : 0), 4.5, 9.2);
  const deepSleepHours = clamp(sleepHours * (0.18 + (s % 7) * 0.015), 0.6, 2.4);
  const hasSleepScore = s % 9 !== 0;
  const sleepScore = hasSleepScore ? clamp(Math.round(62 + (s % 21) * 1.4), 45, 92) : null;

  const hrvAvailable = s % 11 !== 0;
  const hrv = hrvAvailable ? clamp(Math.round(34 + (s % 19) * 1.1), 28, 58) : null;

  const avgStress = clamp(Math.round(22 + (s % 15) * 2.2 + (sleepHours < 6 ? 8 : 0)), 12, 58);
  const maxStress = clamp(avgStress + 18 + (s % 10), 35, 99);

  const bodyBatteryHigh = clamp(72 + (s % 14) * 2, 55, 100);
  const bodyBatteryLow = clamp(bodyBatteryHigh - (28 + (s % 12)), 8, bodyBatteryHigh - 10);
  const bodyBatteryCharged = clamp(Math.round(35 + (s % 8) * 4), 20, 65);
  const bodyBatteryDrained = clamp(Math.round(28 + (s % 9) * 3), 15, 55);

  const moderateIntensityMin = clamp(Math.round(steps / 180 + (s % 6) * 4), 0, 65);
  const vigorousIntensityMin = clamp(Math.round(activeCalories / 45 + (s % 4) * 3), 0, 35);

  const stressCurve = buildCurve(s, avgStress, 14);
  const bodyBatteryCurve = buildCurve(s + 3, (bodyBatteryHigh + bodyBatteryLow) / 2, 22);

  return {
    date: dateKey,
    steps,
    stepGoal: STEP_GOAL,
    totalCalories,
    activeCalories,
    bmrCalories,
    restingHr: clamp(52 + (s % 9) - (sleepHours >= 7.5 ? 2 : 0), 48, 62),
    sleepHours: Math.round(sleepHours * 10) / 10,
    deepSleepHours: Math.round(deepSleepHours * 10) / 10,
    sleepScore,
    hrv,
    hrvStatus: hrvStatus(hrv),
    avgStress,
    maxStress,
    bodyBatteryHigh,
    bodyBatteryLow,
    bodyBatteryCharged,
    bodyBatteryDrained,
    moderateIntensityMin,
    vigorousIntensityMin,
    stressCurve,
    bodyBatteryCurve,
    activities: buildActivities(s, activeCalories),
  };
}

/** Pre-generate mock data for a date range (inclusive). */
export function getMockHealthRange(startKey: string, endKey: string): DailyHealth[] {
  const days: DailyHealth[] = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    days.push(getMockHealthDay(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function getMockHealthToday(): DailyHealth {
  return getMockHealthDay(toDateKey());
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  strength_training: "Strength",
  running: "Run",
  cycling: "Ride",
  walking: "Walk",
  hiking: "Hike",
  other: "Other",
};

export const HRV_STATUS_LABELS: Record<HrvStatus, string> = {
  balanced: "Balanced",
  low: "Low",
  high: "High",
  unavailable: "No data",
};
