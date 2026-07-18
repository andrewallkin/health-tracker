/** Format decimal hours as compact "Xh Ym" (omits zero parts). */
export function formatHoursAsHm(hours: number): string {
  return formatMinutesAsHm(Math.round(hours * 60), { alwaysSplitHours: true });
}

/**
 * Format minutes.
 * - Under or equal to 60: "Nm"
 * - Over 60: "Xh Ym" (omits zero minutes)
 *
 * When `alwaysSplitHours` is true (sleep totals), exact hours render as "Xh"
 * and sub-hour values as "Nm" / "Xh Ym".
 */
export function formatMinutesAsHm(
  minutes: number,
  options?: { alwaysSplitHours?: boolean },
): string {
  const total = Math.max(0, Math.round(minutes));
  const alwaysSplit = options?.alwaysSplitHours ?? false;

  if (!alwaysSplit && total <= 60) {
    return `${total}m`;
  }

  const h = Math.floor(total / 60);
  const m = total % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
