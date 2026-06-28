import { useCallback, useEffect, useState } from "react";

import {
  createLogEntry,
  createSavedFood,
  createSavedMeal,
  deleteLogEntry,
  deleteSavedMeal,
  fetchAiSettings,
  fetchEntriesForDate,
  fetchGoals,
  fetchSavedFoods,
  fetchSavedMeals,
  tryDeleteSavedFood,
  updateAiSettings,
  updateGoals,
  updateLogEntry,
  updateSavedFood,
  updateSavedMeal,
} from "../lib/api";
import { ApiError } from "../lib/client";
import { useConfirm } from "../context/useConfirm";
import { buildLogEntryFromSavedMeal, type LogMealPayload } from "../lib/logEntry";
import {
  buildQuickLogEntry,
  type QuickLogPayload,
  updateQuickLogEntry,
} from "../lib/quickLog";
import {
  formatAffectedMealNames,
  getMealsUsingFood,
  parseFoodDeleteConflict,
  type NewSavedFoodPayload,
} from "../lib/savedFood";
import { findSavedMeal, type NewSavedMealPayload } from "../lib/savedMeal";
import type { SettingsSavePayload } from "../components/nutrition/pages/GoalsSettingsPage";
import type { DailyGoal, LogEntry, SavedFood, SavedMeal } from "../types/nutrition";

export function useNutritionData(selectedDate: string) {
  const confirm = useConfirm();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [entriesReloadKey, setEntriesReloadKey] = useState(0);
  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loadingNutrition, setLoadingNutrition] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteEntryError, setDeleteEntryError] = useState<string | null>(null);

  const reloadEntries = useCallback(() => {
    setEntriesReloadKey((key) => key + 1);
  }, []);

  const retryBootstrap = useCallback(() => {
    setLoadingNutrition(true);
    setLoadError(null);
    Promise.all([fetchGoals(), fetchSavedMeals(), fetchSavedFoods(), fetchAiSettings()])
      .then(([loadedGoal, meals, foods, ai]) => {
        setGoal(loadedGoal);
        setSavedMeals(meals);
        setSavedFoods(foods);
        setHasApiKey(ai.hasApiKey);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Could not load nutrition data.");
      })
      .finally(() => {
        setLoadingNutrition(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchGoals(), fetchSavedMeals(), fetchSavedFoods(), fetchAiSettings()])
      .then(([loadedGoal, meals, foods, ai]) => {
        if (!cancelled) {
          setGoal(loadedGoal);
          setSavedMeals(meals);
          setSavedFoods(foods);
          setHasApiKey(ai.hasApiKey);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load nutrition data.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingNutrition(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchEntriesForDate(selectedDate)
      .then((loaded) => {
        if (!cancelled) setEntries(loaded);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, entriesReloadKey]);

  const addSavedMealEntry = async (payload: LogMealPayload, mealId: string) => {
    const meal = findSavedMeal(savedMeals, mealId);
    if (!meal) throw new Error("Saved meal not found.");
    const built = buildLogEntryFromSavedMeal(meal, payload);
    const created = await createLogEntry({
      logDate: selectedDate,
      name: built.name,
      slot: built.slot,
      time: built.time,
      servings: built.servings,
      calories: built.calories,
      protein: built.protein,
      carbs: built.carbs,
      fat: built.fat,
      savedMealId: built.savedMealId,
      imageUrl: built.imageUrl,
    });
    setEntries((prev) => [...prev, created]);
    reloadEntries();
  };

  const updateSavedMealEntry = async (
    entryId: string,
    payload: LogMealPayload,
    mealId: string,
  ) => {
    const meal = findSavedMeal(savedMeals, mealId);
    if (!meal) throw new Error("Saved meal not found.");
    const existing = entries.find((entry) => entry.id === entryId);
    if (!existing) throw new Error("Entry not found.");
    const built = buildLogEntryFromSavedMeal(meal, payload);
    const updated = await updateLogEntry(entryId, {
      name: built.name,
      slot: built.slot,
      time: existing.time,
      servings: built.servings,
      calories: built.calories,
      protein: built.protein,
      carbs: built.carbs,
      fat: built.fat,
      savedMealId: built.savedMealId,
      imageUrl: built.imageUrl,
    });
    setEntries((prev) => prev.map((entry) => (entry.id === entryId ? updated : entry)));
    reloadEntries();
  };

  const addQuickLogEntry = async (payload: QuickLogPayload) => {
    const built = buildQuickLogEntry(payload);
    const created = await createLogEntry({
      logDate: selectedDate,
      name: built.name,
      slot: built.slot,
      time: built.time,
      servings: built.servings,
      calories: built.calories,
      protein: built.protein,
      carbs: built.carbs,
      fat: built.fat,
      imageUrl: built.imageUrl,
    });
    setEntries((prev) => [...prev, created]);
    reloadEntries();
  };

  const updateQuickLogEntryById = async (entryId: string, payload: QuickLogPayload) => {
    const existing = entries.find((entry) => entry.id === entryId);
    if (!existing) throw new Error("Entry not found.");
    const built = updateQuickLogEntry(existing, payload);
    const updated = await updateLogEntry(entryId, {
      name: built.name,
      slot: built.slot,
      calories: built.calories,
      protein: built.protein,
      carbs: built.carbs,
      fat: built.fat,
    });
    setEntries((prev) => prev.map((entry) => (entry.id === entryId ? updated : entry)));
    reloadEntries();
  };

  const addSavedMeal = async (payload: NewSavedMealPayload) => {
    const created = await createSavedMeal(payload);
    setSavedMeals((prev) => [...prev, created]);
  };

  const editSavedMeal = async (mealId: string, payload: NewSavedMealPayload) => {
    const updated = await updateSavedMeal(mealId, payload);
    setSavedMeals((prev) => prev.map((meal) => (meal.id === mealId ? updated : meal)));
  };

  const removeSavedMeal = async (mealId: string) => {
    await deleteSavedMeal(mealId);
    setSavedMeals((prev) => prev.filter((meal) => meal.id !== mealId));
    setEntries((prev) =>
      prev.map((entry) =>
        entry.savedMealId === mealId ? { ...entry, savedMealId: undefined } : entry,
      ),
    );
  };

  const addSavedFood = async (payload: NewSavedFoodPayload) => {
    const created = await createSavedFood(payload);
    setSavedFoods((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const editSavedFood = async (foodId: string, payload: Partial<NewSavedFoodPayload>) => {
    const updated = await updateSavedFood(foodId, payload);
    setSavedFoods((prev) =>
      prev
        .map((food) => (food.id === foodId ? updated : food))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    const meals = await fetchSavedMeals();
    setSavedMeals(meals);
  };

  const removeSavedFood = async (foodId: string) => {
    const affectedMeals = getMealsUsingFood(savedMeals, foodId);

    const promptDelete = (message: string) =>
      confirm({
        title: "Delete saved food?",
        message,
        confirmLabel: "Delete",
        destructive: true,
      });

    if (affectedMeals.length > 0) {
      const mealList = formatAffectedMealNames(affectedMeals);
      const ok = await promptDelete(
        `This food is used in: ${mealList}. Remove it from those meals and delete the food?`,
      );
      if (!ok) return;
      const result = await tryDeleteSavedFood(foodId, true);
      if (!result.ok) {
        throw new ApiError(
          result.status,
          typeof result.detail === "string" ? result.detail : "Could not delete saved food.",
        );
      }
    } else {
      const ok = await promptDelete("This removes the food from your library.");
      if (!ok) return;
      let result = await tryDeleteSavedFood(foodId, false);
      if (!result.ok && result.status === 409) {
        const conflict = parseFoodDeleteConflict(result.detail);
        const mealList =
          conflict && conflict.affectedMealNames.length > 0
            ? conflict.affectedMealNames.join(", ")
            : "saved meals";
        const retryOk = await promptDelete(
          `This food is used in: ${mealList}. Remove it from those meals and delete the food?`,
        );
        if (!retryOk) return;
        result = await tryDeleteSavedFood(foodId, true);
      }
      if (!result.ok) {
        throw new ApiError(
          result.status,
          typeof result.detail === "string" ? result.detail : "Could not delete saved food.",
        );
      }
    }

    setSavedFoods((prev) => prev.filter((food) => food.id !== foodId));
    const meals = await fetchSavedMeals();
    setSavedMeals(meals);
  };

  const handleDeleteEntry = async (id: string) => {
    setDeleteEntryError(null);
    try {
      await deleteLogEntry(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      reloadEntries();
    } catch (err) {
      setDeleteEntryError(err instanceof Error ? err.message : "Could not delete entry.");
    }
  };

  const handleSaveSettings = async ({ goal: updatedGoal, ai }: SettingsSavePayload) => {
    const [savedGoal, savedAi] = await Promise.all([
      updateGoals(updatedGoal),
      updateAiSettings(ai),
    ]);
    setGoal(savedGoal);
    setHasApiKey(savedAi.hasApiKey);
  };

  const nutritionReady = !loadingNutrition && goal !== null && loadError === null;

  return {
    entries,
    entriesReloadKey,
    goal,
    savedMeals,
    savedFoods,
    hasApiKey,
    loadingNutrition,
    loadError,
    deleteEntryError,
    nutritionReady,
    setHasApiKey,
    reloadEntries,
    retryBootstrap,
    addSavedMealEntry,
    updateSavedMealEntry,
    addQuickLogEntry,
    updateQuickLogEntryById,
    addSavedMeal,
    editSavedMeal,
    removeSavedMeal,
    addSavedFood,
    editSavedFood,
    removeSavedFood,
    handleDeleteEntry,
    handleSaveSettings,
    dismissDeleteEntryError: () => setDeleteEntryError(null),
  };
}
