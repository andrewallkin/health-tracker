import { addDays, formatShortDate, isToday, toDateKey } from "./dates";

export function isYesterday(dateKey: string): boolean {
  return dateKey === addDays(toDateKey(), -1);
}

export function isFutureDate(dateKey: string): boolean {
  return dateKey > toDateKey();
}

export function addToDayLabel(dateKey: string): string {
  if (isToday(dateKey)) return "Add to today";
  if (isYesterday(dateKey)) return "Add to yesterday";
  return `Add to ${formatShortDate(dateKey)}`;
}

export function confirmLogLabel(addToDay: boolean, saveAsMeal: boolean, dateKey: string): string {
  if (addToDay && saveAsMeal) return `${addToDayLabel(dateKey)} & save meal`;
  if (addToDay) return addToDayLabel(dateKey);
  return "Save meal";
}
