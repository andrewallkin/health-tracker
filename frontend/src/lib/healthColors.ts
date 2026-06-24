export type TargetBand = "poor" | "fair" | "good" | "great";

export interface BandStyle {
  stroke: string;
  fill: string;
  bg: string;
  text: string;
  badgeBg: string;
}

export const BAND_STYLES: Record<TargetBand, BandStyle> = {
  poor: {
    stroke: "#ef4444",
    fill: "rgb(239 68 68 / 0.15)",
    bg: "bg-red-500/75",
    text: "text-red-400",
    badgeBg: "bg-red-500/15 text-red-400",
  },
  fair: {
    stroke: "#f97316",
    fill: "rgb(249 115 22 / 0.15)",
    bg: "bg-orange-500/75",
    text: "text-orange-400",
    badgeBg: "bg-orange-500/15 text-orange-400",
  },
  good: {
    stroke: "#eab308",
    fill: "rgb(234 179 8 / 0.15)",
    bg: "bg-yellow-500/80",
    text: "text-yellow-400",
    badgeBg: "bg-yellow-500/15 text-yellow-400",
  },
  great: {
    stroke: "#22c55e",
    fill: "rgb(34 197 94 / 0.15)",
    bg: "bg-emerald-500/80",
    text: "text-emerald-400",
    badgeBg: "bg-emerald-500/15 text-emerald-400",
  },
};

/** Higher actual vs target is better. */
export function bandFromRatio(actual: number, target: number): TargetBand {
  if (target <= 0) return "poor";
  const ratio = actual / target;
  if (ratio < 0.5) return "poor";
  if (ratio < 0.75) return "fair";
  if (ratio < 1) return "good";
  return "great";
}

/** Lower value vs ceiling is better (e.g. stress). */
export function bandFromCeiling(value: number, ceiling: number): TargetBand {
  if (ceiling <= 0) return "great";
  const ratio = value / ceiling;
  if (ratio <= 0.5) return "great";
  if (ratio <= 0.75) return "good";
  if (ratio <= 1) return "fair";
  return "poor";
}

export function styleForRatio(actual: number, target: number): BandStyle {
  return BAND_STYLES[bandFromRatio(actual, target)];
}

export function styleForCeiling(value: number, ceiling: number): BandStyle {
  return BAND_STYLES[bandFromCeiling(value, ceiling)];
}

export function heatClassFromRatio(actual: number, target: number): string {
  return styleForRatio(actual, target).bg;
}
