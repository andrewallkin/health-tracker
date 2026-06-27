import { getMockHealthDay, getMockHealthRange } from "../data/mockHealth";
import { getMonthGrid, getWeekRange } from "./dates";
import type {
  ActivityType,
  DailyHealth,
  HealthMonthSummary,
  HealthWeekSummary,
} from "../types/health";

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function averageNullable(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.round(average(valid));
}

export function getHealthDay(dateKey: string): DailyHealth {
  return getMockHealthDay(dateKey);
}

export function aggregateHealthWeek(anchorDate: string): HealthWeekSummary {
  const { start, end, dates } = getWeekRange(anchorDate);
  const days = dates.map((date) => getMockHealthDay(date));

  const totalWorkoutMin = days.reduce(
    (sum, day) => sum + day.activities.reduce((a, act) => a + act.durationMin, 0),
    0,
  );

  return {
    startDate: start,
    endDate: end,
    days,
    avgSteps: Math.round(average(days.map((d) => d.steps))),
    avgSleepHours: Math.round(average(days.map((d) => d.sleepHours)) * 10) / 10,
    avgActiveCalories: Math.round(average(days.map((d) => d.activeCalories))),
    avgStress: Math.round(average(days.map((d) => d.avgStress))),
    avgHrv: averageNullable(days.map((d) => d.hrv)),
    stepGoalDays: days.filter((d) => d.steps >= d.stepGoal).length,
    totalActivities: days.reduce((sum, d) => sum + d.activities.length, 0),
    totalWorkoutMin,
  };
}

export function aggregateHealthMonth(anchorDate: string): HealthMonthSummary {
  const [yearStr, monthStr] = anchorDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;

  const gridDates = getMonthGrid(year, month);
  const days = gridDates.map((date) => getMockHealthDay(date));
  const inMonth = days.filter((d) => {
    const [y, m] = d.date.split("-").map(Number);
    return y === year && m - 1 === month;
  });

  const activityByType: Record<ActivityType, number> = {
    strength_training: 0,
    running: 0,
    cycling: 0,
    walking: 0,
    hiking: 0,
    other: 0,
  };

  for (const day of inMonth) {
    for (const activity of day.activities) {
      activityByType[activity.type] += 1;
    }
  }

  return {
    year,
    month,
    days,
    totalSteps: inMonth.reduce((sum, d) => sum + d.steps, 0),
    avgSteps: Math.round(average(inMonth.map((d) => d.steps))),
    avgSleepHours: Math.round(average(inMonth.map((d) => d.sleepHours)) * 10) / 10,
    avgActiveCalories: Math.round(average(inMonth.map((d) => d.activeCalories))),
    stepGoalDays: inMonth.filter((d) => d.steps >= d.stepGoal).length,
    totalActivities: inMonth.reduce((sum, d) => sum + d.activities.length, 0),
    activityByType,
  };
}

export function stepHeatLevel(steps: number, goal: number): "none" | "low" | "mid" | "high" {
  if (steps <= 0) return "none";
  const ratio = steps / goal;
  if (ratio < 0.5) return "low";
  if (ratio < 0.85) return "mid";
  return "high";
}

/** Range helper for future API sync. */
export function getHealthRange(startKey: string, endKey: string): DailyHealth[] {
  return getMockHealthRange(startKey, endKey);
}
