import { useCallback, useState } from "react";

import type { DescribeFoodInput, FoodEstimate } from "../types/foodEstimate";

export interface EstimateSession {
  input: DescribeFoodInput;
  estimate: FoodEstimate;
}

export function useEstimateFlow() {
  const [estimateSession, setEstimateSession] = useState<EstimateSession | null>(null);

  const clearEstimateSession = useCallback(() => {
    setEstimateSession(null);
  }, []);

  const startEstimateReview = useCallback((input: DescribeFoodInput, estimate: FoodEstimate) => {
    setEstimateSession({ input, estimate });
  }, []);

  return {
    estimateSession,
    setEstimateSession,
    clearEstimateSession,
    startEstimateReview,
  };
}
