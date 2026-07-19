import { flushSync } from "react-dom";

import type { ReviewConfirmOptions } from "../types/foodEstimate";
import type { AppView } from "../types/nutrition";

/** Destination after a successful AI estimate confirm. */
export function viewAfterEstimateConfirm(options: ReviewConfirmOptions): AppView {
  if (options.addToDay) return { type: "today" };
  if (options.saveAsFood) return { type: "saved-meals", tab: "foods" };
  return { type: "saved-meals", tab: "meals" };
}

/**
 * Leave estimate review, then clear session.
 * Clearing first races App's missing-session redirect back to describe-food
 * while the URL is still `/food/estimate/review`.
 */
export function finishEstimateConfirm(args: {
  options: ReviewConfirmOptions;
  onViewChange: (view: AppView) => void;
  clearEstimateSession: () => void;
}): void {
  flushSync(() => {
    args.onViewChange(viewAfterEstimateConfirm(args.options));
  });
  args.clearEstimateSession();
}
