import type { DescribeFoodInput, FoodEstimate } from "../types/foodEstimate";

export interface EstimateSession {
  input: DescribeFoodInput;
  estimate: FoodEstimate;
}

const STORAGE_KEY = "health-tracker:estimate-session";

export function loadEstimateSession(): EstimateSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EstimateSession;
    if (!parsed?.input || !parsed?.estimate) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveEstimateSession(session: EstimateSession | null): void {
  if (!session) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}
