import type { ActivityType } from "../types/health";

/** Map Garmin `activityType.typeKey` values onto our curated ActivityType union. */
const GARMIN_TYPE_KEY_MAP: Record<string, ActivityType> = {
  strength_training: "strength_training",
  indoor_cardio: "cardio",
  cardio: "cardio",
  running: "running",
  trail_running: "running",
  treadmill_running: "running",
  cycling: "cycling",
  road_biking: "cycling",
  indoor_cycling: "cycling",
  walking: "walking",
  hiking: "hiking",
};

export function mapGarminActivityType(
  typeKey: string | null | undefined,
): ActivityType {
  if (!typeKey) return "other";
  return GARMIN_TYPE_KEY_MAP[typeKey] ?? "other";
}
