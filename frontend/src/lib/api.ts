import type { DescribeFoodInput, FoodEstimate } from "../types/foodEstimate";
import type { CheckIn, CheckInUpsertPayload } from "../types/health";
import type { DailyGoal, LogEntry, SavedFood, SavedMeal } from "../types/nutrition";
import type { NewSavedFoodPayload } from "./savedFood";
import type { NewSavedMealPayload } from "./savedMeal";
import { API_BASE, ApiError, apiFetch, parseErrorMessage, request } from "./client";

export { ApiError };

export const DEFAULT_DAILY_GOAL: DailyGoal = {
  calories: 2200,
  protein: 180,
  carbs: 220,
  fat: 70,
};

export interface AiSettings {
  hasApiKey: boolean;
  apiKeyHint: string | null;
  textModel: string;
  imageModel: string;
}

export interface AiSettingsUpdate {
  apiKey?: string;
  clearApiKey?: boolean;
  textModel: string;
  imageModel: string;
}

export interface ModelOption {
  id: string;
  label: string;
  supportsVision: boolean;
  recommendedFor?: "text" | "image" | null;
}

export interface LogEntryCreate {
  logDate: string;
  name: string;
  slot: LogEntry["slot"];
  time: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  savedMealId?: string;
  imageUrl?: string;
}

export async function fetchGoals(): Promise<DailyGoal | null> {
  const response = await apiFetch("/goals");
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }
  return (await response.json()) as DailyGoal;
}

export async function updateGoals(goal: DailyGoal): Promise<DailyGoal> {
  return request<DailyGoal>("/goals", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goal),
  });
}

export async function fetchSavedMeals(): Promise<SavedMeal[]> {
  return request<SavedMeal[]>("/meals");
}

export async function createSavedMeal(payload: NewSavedMealPayload): Promise<SavedMeal> {
  return request<SavedMeal>("/meals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateSavedMeal(
  id: string,
  payload: Partial<NewSavedMealPayload>,
): Promise<SavedMeal> {
  return request<SavedMeal>(`/meals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteSavedMeal(id: string): Promise<void> {
  await request<void>(`/meals/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchSavedFoods(): Promise<SavedFood[]> {
  return request<SavedFood[]>("/foods");
}

export async function createSavedFood(payload: NewSavedFoodPayload): Promise<SavedFood> {
  return request<SavedFood>("/foods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateSavedFood(
  id: string,
  payload: Partial<NewSavedFoodPayload>,
): Promise<SavedFood> {
  return request<SavedFood>(`/foods/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteSavedFood(id: string, confirm = false): Promise<void> {
  const suffix = confirm ? "?confirm=true" : "";
  await request<void>(`/foods/${encodeURIComponent(id)}${suffix}`, { method: "DELETE" });
}

export async function tryDeleteSavedFood(
  id: string,
  confirm = false,
): Promise<{ ok: true } | { ok: false; status: number; detail: unknown }> {
  const suffix = confirm ? "?confirm=true" : "";
  const response = await apiFetch(`/foods/${encodeURIComponent(id)}${suffix}`, {
    method: "DELETE",
  });
  if (response.ok) return { ok: true };
  let detail: unknown = response.statusText;
  try {
    detail = (await response.json()).detail;
  } catch {
    // ignore
  }
  return { ok: false, status: response.status, detail };
}

export async function uploadMealPhoto(
  file: Blob,
  filename = "meal.jpg",
): Promise<{ path: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file, filename);

  const response = await apiFetch("/photos", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message);
  }

  const data = (await response.json()) as { path: string; url: string };
  return data;
}

export async function uploadCheckInPhoto(
  file: Blob,
  filename = "check-in.jpg",
): Promise<{ path: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file, filename);

  const response = await apiFetch("/photos?purpose=check-in", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message);
  }

  const data = (await response.json()) as { path: string; url: string };
  return data;
}

export async function fetchCheckInForDate(dateKey: string): Promise<CheckIn | null> {
  return request<CheckIn | null>(`/check-ins?date=${encodeURIComponent(dateKey)}`);
}

export async function fetchCheckInsInRange(from: string, to: string): Promise<CheckIn[]> {
  const params = new URLSearchParams({ from, to });
  return request<CheckIn[]>(`/check-ins?${params}`);
}

export async function upsertCheckIn(payload: CheckInUpsertPayload): Promise<CheckIn> {
  return request<CheckIn>("/check-ins", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteCheckIn(id: string): Promise<void> {
  await request<void>(`/check-ins/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchEntriesForDate(dateKey: string): Promise<LogEntry[]> {
  return request<LogEntry[]>(`/entries?date=${encodeURIComponent(dateKey)}`);
}

export async function fetchEntriesInRange(from: string, to: string): Promise<LogEntry[]> {
  const params = new URLSearchParams({ from, to });
  return request<LogEntry[]>(`/entries?${params}`);
}

export async function createLogEntry(payload: LogEntryCreate): Promise<LogEntry> {
  return request<LogEntry>("/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateLogEntry(
  id: string,
  payload: Partial<Omit<LogEntryCreate, "logDate">>,
): Promise<LogEntry> {
  return request<LogEntry>(`/entries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteLogEntry(id: string): Promise<void> {
  await request<void>(`/entries/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchAiSettings(): Promise<AiSettings> {
  return request<AiSettings>("/settings/ai");
}

export async function updateAiSettings(payload: AiSettingsUpdate): Promise<AiSettings> {
  return request<AiSettings>("/settings/ai", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchModelOptions(): Promise<ModelOption[]> {
  const response = await request<{ models: ModelOption[] }>("/settings/models");
  return response.models;
}

export async function estimateFood(input: DescribeFoodInput): Promise<FoodEstimate> {
  const photos = input.photoUrl ? [input.photoUrl] : [];
  return request<FoodEstimate>("/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: input.note || null, photos }),
  });
}

export { API_BASE };
