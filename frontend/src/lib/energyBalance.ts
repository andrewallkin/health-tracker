import type { DailyTotals } from "../types/nutrition";

export type EnergyBalanceReason = "disconnected" | "error" | "missing";

export type EnergyBalance =
  | { status: "loading" }
  | { status: "unavailable"; reason: EnergyBalanceReason }
  | {
      status: "ready";
      eaten: number;
      burned: number;
      net: number;
      daysUsed?: number;
    };

export type EnergyBalanceFetchState = {
  loading: boolean;
  garminDisconnected: boolean;
  loadError: string | null;
};

function fetchGate(fetch: EnergyBalanceFetchState): EnergyBalance | null {
  if (fetch.loading) return { status: "loading" };
  if (fetch.garminDisconnected) return { status: "unavailable", reason: "disconnected" };
  if (fetch.loadError) return { status: "unavailable", reason: "error" };
  return null;
}

export function dayEnergyBalance(
  eaten: number,
  burned: number | null | undefined,
  fetch: EnergyBalanceFetchState,
): EnergyBalance {
  const gated = fetchGate(fetch);
  if (gated) return gated;
  if (burned == null || Number.isNaN(burned)) {
    return { status: "unavailable", reason: "missing" };
  }
  return { status: "ready", eaten, burned, net: eaten - burned };
}

export function rangeEnergyBalance(
  days: DailyTotals[],
  burnByDate: ReadonlyMap<string, number | null | undefined>,
  fetch: EnergyBalanceFetchState,
): EnergyBalance {
  const gated = fetchGate(fetch);
  if (gated) return gated;

  const paired: Array<{ eaten: number; burned: number }> = [];
  for (const day of days) {
    if (!day.countsInAverages) continue;
    const burned = burnByDate.get(day.date);
    if (burned == null || Number.isNaN(burned)) continue;
    paired.push({ eaten: day.consumed.calories, burned });
  }

  if (paired.length === 0) {
    return { status: "unavailable", reason: "missing" };
  }

  const eaten = Math.round(paired.reduce((s, p) => s + p.eaten, 0) / paired.length);
  const burned = Math.round(paired.reduce((s, p) => s + p.burned, 0) / paired.length);
  return {
    status: "ready",
    eaten,
    burned,
    net: eaten - burned,
    daysUsed: paired.length,
  };
}
