export type HrvStatus = "balanced" | "unbalanced" | "low" | "poor" | "unavailable";

export type ActivityType =
  | "strength_training"
  | "running"
  | "cycling"
  | "walking"
  | "hiking"
  | "cardio"
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
  minHr: number;
  maxHr: number;
  avgRestingHr7d: number;
  sleepHours: number;
  deepSleepHours: number;
  remSleepHours: number;
  lightSleepHours: number;
  sleepAvgHr: number;
  sleepScore: number | null;
  hrv: number | null;
  hrvStatus: HrvStatus;
  hrvWeeklyAvg: number | null;
  activities: HealthActivity[];
}

export interface HealthWeekSummary {
  startDate: string;
  endDate: string;
  days: DailyHealth[];
  avgSteps: number;
  avgSleepHours: number;
  avgSleepScore: number | null;
  avgTotalCalories: number;
  avgBmrCalories: number;
  avgActiveCalories: number;
  avgRestingHr: number | null;
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
  avgSleepScore: number | null;
  avgTotalCalories: number;
  avgBmrCalories: number;
  avgActiveCalories: number;
  avgRestingHr: number | null;
  avgHrv: number | null;
  stepGoalDays: number;
  totalActivities: number;
  totalWorkoutMin: number;
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
