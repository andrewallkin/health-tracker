import { addDays, daysBetween } from "./dates";
import { parseLocaleNumber } from "./numericInput";

const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;
const MAX_PHOTOS = 10;

export function isCheckInValid(weightInput: string, photoPaths: string[]): boolean {
  const hasPhotos = photoPaths.length > 0;
  const trimmed = weightInput.trim();
  if (!hasPhotos && trimmed.length === 0) return false;
  if (trimmed.length === 0) return hasPhotos;
  const weight = parseLocaleNumber(trimmed);
  if (!Number.isFinite(weight)) return false;
  return weight >= MIN_WEIGHT_KG && weight <= MAX_WEIGHT_KG;
}

export function parseWeightKg(weightInput: string): number | null {
  const trimmed = weightInput.trim();
  if (trimmed.length === 0) return null;
  const weight = parseLocaleNumber(trimmed);
  if (!Number.isFinite(weight) || weight < MIN_WEIGHT_KG || weight > MAX_WEIGHT_KG) {
    return null;
  }
  return weight;
}

export interface SevenDayWeightAverage {
  averageKg: number;
  sampleCount: number;
}

export function sevenDayWeightAverage(
  dateKey: string,
  checkIns: Array<{ checkInDate: string; weightKg: number | null }>,
): SevenDayWeightAverage | null {
  const windowDates = Array.from({ length: 7 }, (_, index) => addDays(dateKey, index - 6));
  const weightByDate = new Map<string, number>();
  for (const checkIn of checkIns) {
    if (checkIn.weightKg === null) continue;
    weightByDate.set(checkIn.checkInDate, checkIn.weightKg);
  }
  const weights = windowDates
    .map((date) => weightByDate.get(date))
    .filter((weight): weight is number => weight !== undefined);
  if (weights.length === 0) return null;
  const sum = weights.reduce((total, weight) => total + weight, 0);
  return { averageKg: sum / weights.length, sampleCount: weights.length };
}

export function formatWeightKg(weightKg: number): string {
  return weightKg.toFixed(2);
}

export function formatSevenDayAvgKg(averageKg: number): string {
  return formatWeightKg(averageKg);
}

export function sevenDayWeightAverageAsOf(
  dateKey: string,
  checkIns: Array<{ checkInDate: string; weightKg: number | null }>,
  today: string,
): SevenDayWeightAverage | null {
  if (dateKey > today) return null;
  return sevenDayWeightAverage(dateKey, checkIns);
}

export function checkInWeekFetchRange(
  weekStart: string,
  weekEnd: string,
  today: string,
): { from: string; to: string } {
  const calendarFrom = addDays(weekStart, -6);
  const rollingFrom = addDays(today, -12);
  return {
    from: calendarFrom < rollingFrom ? calendarFrom : rollingFrom,
    to: weekEnd > today ? weekEnd : today,
  };
}

export interface WeightChartDay {
  date: string;
  weekday: string;
  weight: number | null;
  avg: SevenDayWeightAverage | null;
}

export function firstWeightedDate(
  checkIns: Array<{ checkInDate: string; weightKg: number | null }>,
): string | null {
  let earliest: string | null = null;
  for (const checkIn of checkIns) {
    if (checkIn.weightKg === null) continue;
    if (earliest === null || checkIn.checkInDate < earliest) {
      earliest = checkIn.checkInDate;
    }
  }
  return earliest;
}

export function clampDatesFrom(dates: string[], earliest: string | null): string[] {
  if (earliest === null) return dates;
  return dates.filter((date) => date >= earliest);
}

export function toWeightChartDays(
  dates: string[],
  checkIns: Array<{ checkInDate: string; weightKg: number | null }>,
  today: string,
): WeightChartDay[] {
  const weightByDate = new Map<string, number | null>();
  for (const checkIn of checkIns) {
    weightByDate.set(checkIn.checkInDate, checkIn.weightKg);
  }
  return dates.map((date) => ({
    date,
    weekday: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" }),
    weight: weightByDate.get(date) ?? null,
    avg: sevenDayWeightAverageAsOf(date, checkIns, today),
  }));
}

export function checkInMonthFetchRange(
  monthStart: string,
  monthEnd: string,
  today: string,
): { from: string; to: string } {
  const monthLookback = addDays(monthStart, -6);
  const rollingLookback = addDays(today, -35);
  return {
    from: monthLookback < rollingLookback ? monthLookback : rollingLookback,
    to: monthEnd > today ? monthEnd : today,
  };
}

export function checkInDayDeltaFetchRange(asOf: string): { from: string; to: string } {
  return { from: addDays(asOf, -36), to: asOf };
}

export const ROLLING_AVG_DELTA_PERIODS = [
  { periodDays: 1, fullLabel: "1 day" },
  { periodDays: 7, fullLabel: "7 days" },
  { periodDays: 14, fullLabel: "14 days" },
  { periodDays: 30, fullLabel: "1 month" },
] as const;

export interface RollingAverageDelta {
  periodDays: number;
  label: string;
  deltaKg: number;
  startDate: string;
  endDate: string;
}

export function rollingAverageDeltas(
  asOf: string,
  checkIns: Array<{ checkInDate: string; weightKg: number | null }>,
  today: string,
): Array<RollingAverageDelta | null> {
  const endAvg = sevenDayWeightAverageAsOf(asOf, checkIns, today);
  const firstDate = firstWeightedDate(checkIns);

  return ROLLING_AVG_DELTA_PERIODS.map(({ periodDays, fullLabel }) => {
    if (endAvg === null) return null;

    const intendedStart = addDays(asOf, -periodDays);
    const actualStart =
      intendedStart > (firstDate ?? intendedStart) ? intendedStart : (firstDate ?? intendedStart);

    if (actualStart >= asOf) return null;

    const startAvg = sevenDayWeightAverageAsOf(actualStart, checkIns, today);
    if (startAvg === null) return null;

    const spanDays = daysBetween(actualStart, asOf);
    const label =
      actualStart === intendedStart
        ? fullLabel
        : spanDays === 1
          ? "1 day"
          : `${spanDays} days`;

    return {
      periodDays,
      label,
      deltaKg: endAvg.averageKg - startAvg.averageKg,
      startDate: actualStart,
      endDate: asOf,
    };
  });
}

export function formatSignedKg(deltaKg: number): string {
  if (deltaKg === 0) return `${formatWeightKg(0)} kg`;
  if (deltaKg > 0) return `+${formatWeightKg(deltaKg)} kg`;
  return `\u2212${formatWeightKg(Math.abs(deltaKg))} kg`;
}

export { MAX_PHOTOS, MIN_WEIGHT_KG, MAX_WEIGHT_KG };
