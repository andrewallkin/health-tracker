import { useCallback, useState } from "react";

import {
  loadEstimateSession,
  saveEstimateSession,
  type EstimateSession,
} from "../lib/estimateSessionStorage";
import type { DescribeFoodInput, FoodEstimate } from "../types/foodEstimate";

export type { EstimateSession };

export function useEstimateFlow() {
  const [estimateSession, setEstimateSessionState] = useState<EstimateSession | null>(() =>
    loadEstimateSession(),
  );

  const setEstimateSession = useCallback((session: EstimateSession | null) => {
    saveEstimateSession(session);
    setEstimateSessionState(session);
  }, []);

  const clearEstimateSession = useCallback(() => {
    setEstimateSession(null);
  }, [setEstimateSession]);

  const startEstimateReview = useCallback(
    (input: DescribeFoodInput, estimate: FoodEstimate) => {
      setEstimateSession({ input, estimate });
    },
    [setEstimateSession],
  );

  return {
    estimateSession,
    setEstimateSession,
    clearEstimateSession,
    startEstimateReview,
  };
}
