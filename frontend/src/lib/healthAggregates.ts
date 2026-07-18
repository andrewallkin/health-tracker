import { emptyHealthDay } from "../data/mockHealth";
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

export function aggregateHealthWeek(
  anchorDate: string,
  recordedDays: DailyHealth[],
): HealthWeekSummary {
  const { start, end, dates } = getWeekRange(anchorDate);
  const recordedByDate = new Map(recordedDays.map((day) => [day.date, day]));
  const days = dates.map((date) => recordedByDate.get(date) ?? emptyHealthDay(date));
  const recorded = dates
    .map((date) => recordedByDate.get(date))
    .filter((day): day is DailyHealth => day !== undefined);

  const totalWorkoutMin = recorded.reduce(
    (sum, day) => sum + day.activities.reduce((a, act) => a + act.durationMin, 0),
    0,
  );

  return {
    startDate: start,
    endDate: end,
    days,
    avgSteps: Math.round(average(recorded.map((d) => d.steps))),
    avgSleepHours: Math.round(average(recorded.map((d) => d.sleepHours)) * 10) / 10,
    avgSleepScore: averageNullable(recorded.map((d) => d.sleepScore)),
    avgTotalCalories: Math.round(average(recorded.map((d) => d.totalCalories))),
    avgBmrCalories: Math.round(average(recorded.map((d) => d.bmrCalories))),
    avgActiveCalories: Math.round(average(recorded.map((d) => d.activeCalories))),
    avgRestingHr: averageNullable(recorded.map((d) => (d.restingHr > 0 ? d.restingHr : null))),
    avgHrv: averageNullable(recorded.map((d) => d.hrv)),
    stepGoalDays: recorded.filter((d) => d.steps >= d.stepGoal && d.steps > 0).length,
    totalActivities: recorded.reduce((sum, d) => sum + d.activities.length, 0),
    totalWorkoutMin,
  };
}

export function aggregateHealthMonth(
  anchorDate: string,
  recordedDays: DailyHealth[],
): HealthMonthSummary {
  const [yearStr, monthStr] = anchorDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;

  const gridDates = getMonthGrid(year, month);
  const recordedByDate = new Map(recordedDays.map((day) => [day.date, day]));
  const days = gridDates.map((date) => recordedByDate.get(date) ?? emptyHealthDay(date));
  const recorded = recordedDays.filter((day) => {
    const [y, m] = day.date.split("-").map(Number);
    return y === year && m - 1 === month;
  });

  const activityByType: Record<ActivityType, number> = {
    strength_training: 0,
    running: 0,
    cycling: 0,
    walking: 0,
    hiking: 0,
    cardio: 0,
    other: 0,
  };

  for (const day of recorded) {
    for (const activity of day.activities) {
      activityByType[activity.type] += 1;
    }
  }

  const totalWorkoutMin = recorded.reduce(
    (sum, day) => sum + day.activities.reduce((a, act) => a + act.durationMin, 0),
    0,
  );

  return {
    year,
    month,
    days,
    totalSteps: recorded.reduce((sum, d) => sum + d.steps, 0),
    avgSteps: Math.round(average(recorded.map((d) => d.steps))),
    avgSleepHours: Math.round(average(recorded.map((d) => d.sleepHours)) * 10) / 10,
    avgSleepScore: averageNullable(recorded.map((d) => d.sleepScore)),
    avgTotalCalories: Math.round(average(recorded.map((d) => d.totalCalories))),
    avgBmrCalories: Math.round(average(recorded.map((d) => d.bmrCalories))),
    avgActiveCalories: Math.round(average(recorded.map((d) => d.activeCalories))),
    avgRestingHr: averageNullable(recorded.map((d) => (d.restingHr > 0 ? d.restingHr : null))),
    avgHrv: averageNullable(recorded.map((d) => d.hrv)),
    stepGoalDays: recorded.filter((d) => d.steps >= d.stepGoal && d.steps > 0).length,
    totalActivities: recorded.reduce((sum, d) => sum + d.activities.length, 0),
    totalWorkoutMin,
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

