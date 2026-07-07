/** Matches backend `MacrosEstimator.kj_to_kcal_factor`. */
export const KJ_TO_KCAL_FACTOR = 4.184;

export function kjToKcal(kilojoules: number): number {
  return Math.round(kilojoules / KJ_TO_KCAL_FACTOR);
}

export function kcalToKj(calories: number): number {
  return Math.round(calories * KJ_TO_KCAL_FACTOR);
}
