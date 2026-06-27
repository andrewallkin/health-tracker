const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;
const MAX_PHOTOS = 10;

export function isCheckInValid(weightInput: string, photoPaths: string[]): boolean {
  const hasPhotos = photoPaths.length > 0;
  const trimmed = weightInput.trim();
  if (!hasPhotos && trimmed.length === 0) return false;
  if (trimmed.length === 0) return hasPhotos;
  const weight = Number(trimmed);
  if (!Number.isFinite(weight)) return false;
  return weight >= MIN_WEIGHT_KG && weight <= MAX_WEIGHT_KG;
}

export function parseWeightKg(weightInput: string): number | null {
  const trimmed = weightInput.trim();
  if (trimmed.length === 0) return null;
  const weight = Number(trimmed);
  if (!Number.isFinite(weight) || weight < MIN_WEIGHT_KG || weight > MAX_WEIGHT_KG) {
    return null;
  }
  return weight;
}

export { MAX_PHOTOS, MIN_WEIGHT_KG, MAX_WEIGHT_KG };
