export type HrvStatus = "balanced" | "low" | "high" | "unavailable";

export type ActivityType =
  | "strength_training"
  | "running"
  | "cycling"
  | "walking"
  | "hiking"
  | "other";

export interface HealthActivity {
  id: string;
  name: string;
  type: ActivityType;
  startTime: string;
  durationMin: number;
  calories: number;
  avgHr: number;
  distanceKm?: number;
}

export interface DailyHealth {
  date: string;
  steps: number;
  stepGoal: number;
  totalCalories: number;
  activeCalories: number;
  bmrCalories: number;
  restingHr: number;
  sleepHours: number;
  deepSleepHours: number;
  sleepScore: number | null;
  hrv: number | null;
  hrvStatus: HrvStatus;
  avgStress: number;
  maxStress: number;
  bodyBatteryHigh: number;
  bodyBatteryLow: number;
  bodyBatteryCharged: number;
  bodyBatteryDrained: number;
  moderateIntensityMin: number;
  vigorousIntensityMin: number;
  stressCurve: number[];
  bodyBatteryCurve: number[];
  activities: HealthActivity[];
}

export interface HealthWeekSummary {
  startDate: string;
  endDate: string;
  days: DailyHealth[];
  avgSteps: number;
  avgSleepHours: number;
  avgActiveCalories: number;
  avgStress: number;
  avgHrv: number | null;
  stepGoalDays: number;
  totalActivities: number;
  totalWorkoutMin: number;
}

export interface HealthMonthSummary {
  year: number;
  month: number;
  days: DailyHealth[];
  totalSteps: number;
  avgSteps: number;
  avgSleepHours: number;
  avgActiveCalories: number;
  stepGoalDays: number;
  totalActivities: number;
  activityByType: Record<ActivityType, number>;
}

export type AppSection = "nutrition" | "health" | "check-in";

export interface CheckInPhoto {
  id: string;
  imageUrl: string;
  imagePath: string;
  sortOrder: number;
}

export interface CheckIn {
  id: string;
  checkInDate: string;
  recordedAt: string;
  weightKg: number | null;
  notes: string | null;
  photos: CheckInPhoto[];
}

export interface CheckInUpsertPayload {
  checkInDate: string;
  weightKg?: number | null;
  notes?: string | null;
  photoPaths: string[];
}
