import { addDays } from "./dates";
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

export { MAX_PHOTOS, MIN_WEIGHT_KG, MAX_WEIGHT_KG };
