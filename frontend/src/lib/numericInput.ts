/** Strip invalid characters; allow one comma or period as decimal separator. */
export function sanitizeNumericInput(raw: string, allowDecimal = true): string {
  const value = raw.replace(/[^\d.,]/g, "");
  if (!allowDecimal) {
    return value.replace(/[.,]/g, "");
  }

  const separatorIndex = value.search(/[.,]/);
  if (separatorIndex === -1) return value;

  const before = value.slice(0, separatorIndex + 1);
  const after = value.slice(separatorIndex + 1).replace(/[.,]/g, "");
  return before + after;
}

/** Parse user-entered numbers; accepts comma as decimal separator (common on mobile). */
export function parseLocaleNumber(value: string): number {
  const normalized = value.trim().replace(",", ".");
  return Number(normalized);
}

export function parseNonNegative(value: string): number {
  const parsed = parseLocaleNumber(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

export function parsePositive(value: string): number {
  const parsed = parseLocaleNumber(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
}

export function parseDecimal(value: string): number | null {
  const parsed = parseLocaleNumber(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}
