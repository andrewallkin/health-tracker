export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateKey: string, delta: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

export function isToday(dateKey: string): boolean {
  return dateKey === toDateKey();
}

export function formatDayHeader(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatShortDate(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatWeekRange(startKey: string, endKey: string): string {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth && sameYear) {
    return `${start.getDate()} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  const startStr = start.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endStr = end.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function weekdayShort(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString("en-GB", { weekday: "short" });
}

/** Monday-start week containing dateKey. */
export function getWeekDates(dateKey: string): string[] {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(date);
    d.setDate(d.getDate() + i);
    return toDateKey(d);
  });
}

export function getWeekRange(dateKey: string): { start: string; end: string; dates: string[] } {
  const dates = getWeekDates(dateKey);
  return { start: dates[0], end: dates[6], dates };
}

export function addWeeks(dateKey: string, delta: number): string {
  return addDays(dateKey, delta * 7);
}

export function getMonthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() + mondayOffset);

  const endDay = last.getDay();
  const sundayOffset = endDay === 0 ? 0 : 7 - endDay;
  const gridEnd = new Date(last);
  gridEnd.setDate(gridEnd.getDate() + sundayOffset);

  const dates: string[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function monthFromDateKey(dateKey: string): { year: number; month: number } {
  const date = parseDateKey(dateKey);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function addMonths(dateKey: string, delta: number): string {
  const date = parseDateKey(dateKey);
  date.setMonth(date.getMonth() + delta);
  return toDateKey(date);
}

export function isSameMonth(dateKey: string, year: number, month: number): boolean {
  const date = parseDateKey(dateKey);
  return date.getFullYear() === year && date.getMonth() === month;
}
