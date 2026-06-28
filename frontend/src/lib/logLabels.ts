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

export function confirmLogLabel(
  addToDay: boolean,
  saveAsMeal: boolean,
  saveAsFood: boolean,
  dateKey: string,
): string {
  const parts: string[] = [];
  if (addToDay) parts.push(addToDayLabel(dateKey));
  if (saveAsMeal) parts.push("save meal");
  if (saveAsFood) parts.push("save food");
  if (parts.length === 0) return "Confirm";
  if (parts.length === 1) {
    if (saveAsMeal && !addToDay) return "Save meal";
    if (saveAsFood && !addToDay) return "Save food";
    return parts[0]!;
  }
  return parts.join(" & ");
}
