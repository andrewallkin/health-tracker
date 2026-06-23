import { useEffect, useState } from "react";
import {
  createLogEntry,
  createSavedMeal,
  deleteLogEntry,
  deleteSavedMeal,
  fetchAiSettings,
  fetchEntriesForDate,
  fetchGoals,
  fetchSavedMeals,
  updateAiSettings,
  updateGoals,
  updateLogEntry,
  updateSavedMeal,
} from "./lib/api";
import { toDateKey } from "./lib/dates";
import { isFutureDate } from "./lib/logLabels";
import { buildLogEntryFromSavedMeal, type LogMealPayload } from "./lib/logEntry";
import {
  buildQuickLogEntry,
  type QuickLogPayload,
  updateQuickLogEntry,
} from "./lib/quickLog";
import { findSavedMeal, type NewSavedMealPayload } from "./lib/savedMeal";
import type { DescribeFoodInput, FoodEstimate, ReviewedFoodPayload } from "./types/foodEstimate";
import type { AppSection } from "./types/health";
import type { AppView, DailyGoal, DashboardTab, LogEntry, SavedMeal } from "./types/nutrition";
import { HealthDayView } from "./components/health/HealthDayView";
import { HealthMonthView } from "./components/health/HealthMonthView";
import { HealthUnderConstructionPage } from "./components/health/HealthUnderConstructionPage";
import { HealthWeekView } from "./components/health/HealthWeekView";

/** Flip to true when wiring in HealthDayView / HealthWeekView / HealthMonthView. */
const HEALTH_SECTION_ENABLED = false;
import { AppTopBar } from "./components/layout/AppTopBar";
import { TOP_BAR_OFFSET } from "./lib/layout";
import { HomeFooter } from "./components/layout/HomeFooter";
import { Dashboard } from "./components/nutrition/dashboard/Dashboard";
import { MonthView } from "./components/nutrition/dashboard/MonthView";
import { WeekView } from "./components/nutrition/dashboard/WeekView";
import { AddFoodHubPage } from "./components/nutrition/pages/AddFoodHubPage";
import { DescribeFoodPage } from "./components/nutrition/pages/DescribeFoodPage";
import { EstimateReviewPage } from "./components/nutrition/pages/EstimateReviewPage";
import {
  GoalsSettingsPage,
  type SettingsSavePayload,
} from "./components/nutrition/pages/GoalsSettingsPage";
import { LogMealPage } from "./components/nutrition/pages/LogMealPage";
import { NewMealPage } from "./components/nutrition/pages/NewMealPage";
import { QuickLogPage } from "./components/nutrition/pages/QuickLogPage";
import { SavedMealsPage } from "./components/nutrition/pages/SavedMealsPage";
import { PageShell } from "./components/layout/PageShell";

interface EstimateSession {
  input: DescribeFoodInput;
  estimate: FoodEstimate;
}

function reviewedToQuickLog(payload: ReviewedFoodPayload): QuickLogPayload {
  return {
    name: payload.name,
    slot: payload.slot,
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
    imageUrl: payload.imageUrl,
  };
}

function reviewedToSavedMeal(payload: ReviewedFoodPayload): NewSavedMealPayload {
  return {
    name: payload.name,
    description: payload.description,
    imageUrl: payload.imageUrl,
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
  };
}

function App() {
  const [view, setView] = useState<AppView>({ type: "today" });
  const [appSection, setAppSection] = useState<AppSection>("nutrition");
  const [selectedDate, setSelectedDate] = useState(() => toDateKey());
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("day");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [entriesVersion, setEntriesVersion] = useState(0);
  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [estimateSession, setEstimateSession] = useState<EstimateSession | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(true);
  const [deleteEntryError, setDeleteEntryError] = useState<string | null>(null);

  const bumpEntriesVersion = () => setEntriesVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchGoals(), fetchSavedMeals(), fetchAiSettings()])
      .then(([loadedGoal, meals, ai]) => {
        if (!cancelled) {
          setGoal(loadedGoal);
          setSavedMeals(meals);
          setHasApiKey(ai.hasApiKey);
        }
      })
      .catch(console.error)
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
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [selectedDate, entriesVersion]);

  const changeDate = (dateKey: string) => {
    if (isFutureDate(dateKey)) return;
    setSelectedDate(dateKey);
  };

  const openDay = (dateKey: string) => {
    if (isFutureDate(dateKey)) return;
    changeDate(dateKey);
    setDashboardTab("day");
  };

  const switchSection = (section: AppSection) => {
    setAppSection(section);
    setDashboardTab("day");
  };

  const openSettings = () => setView({ type: "goals-settings" });

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
    bumpEntriesVersion();
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
    bumpEntriesVersion();
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
    bumpEntriesVersion();
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
    bumpEntriesVersion();
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

  const handleDeleteEntry = async (id: string) => {
    setDeleteEntryError(null);
    try {
      await deleteLogEntry(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      bumpEntriesVersion();
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
    setView({ type: "today" });
  };

  if (view.type === "goals-settings") {
    if (!goal) {
      return (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">Loading…</p>
      );
    }

    return (
      <GoalsSettingsPage
        initialGoal={goal}
        onBack={() => setView({ type: "today" })}
        onSave={handleSaveSettings}
        onApiKeyChange={setHasApiKey}
      />
    );
  }

  if (view.type === "add-food") {
    return (
      <AddFoodHubPage
        hasApiKey={hasApiKey}
        onBack={() => setView({ type: "today" })}
        onOpenSettings={openSettings}
        onSelect={(option) => {
          if (option === "saved-meals") {
            setView({ type: "saved-meals" });
          } else if (option === "quick-log") {
            setView({ type: "quick-log" });
          } else if (option === "describe-photo") {
            setView({ type: "describe-food" });
          }
        }}
      />
    );
  }

  if (view.type === "describe-food") {
    return (
      <DescribeFoodPage
        initialInput={estimateSession?.input}
        hasApiKey={hasApiKey}
        onBack={() => {
          setEstimateSession(null);
          setView({ type: "add-food" });
        }}
        onOpenSettings={openSettings}
        onEstimated={(input, estimate) => {
          setEstimateSession({ input, estimate });
          setView({ type: "estimate-review" });
        }}
      />
    );
  }

  if (view.type === "estimate-review") {
    if (!estimateSession) {
      return (
        <DescribeFoodPage
          hasApiKey={hasApiKey}
          onBack={() => setView({ type: "add-food" })}
          onOpenSettings={openSettings}
          onEstimated={(input, estimate) => {
            setEstimateSession({ input, estimate });
            setView({ type: "estimate-review" });
          }}
        />
      );
    }

    return (
      <EstimateReviewPage
        input={estimateSession.input}
        estimate={estimateSession.estimate}
        logDate={selectedDate}
        onBack={() => setView({ type: "describe-food" })}
        onConfirm={async (payload, { addToDay, saveAsMeal }) => {
          if (saveAsMeal) await addSavedMeal(reviewedToSavedMeal(payload));
          if (addToDay) await addQuickLogEntry(reviewedToQuickLog(payload));
          setEstimateSession(null);
          setView(addToDay ? { type: "today" } : { type: "saved-meals" });
        }}
      />
    );
  }

  if (view.type === "saved-meals") {
    return (
      <SavedMealsPage
        meals={savedMeals}
        onBack={() => setView({ type: "add-food" })}
        onCreateNew={() => setView({ type: "new-meal" })}
        onSelectMeal={(mealId) => setView({ type: "log-meal", mealId })}
        onEditMeal={(mealId) => setView({ type: "edit-meal", mealId })}
      />
    );
  }

  if (view.type === "new-meal") {
    return (
      <NewMealPage
        onBack={() => setView({ type: "saved-meals" })}
        onSave={async (payload) => {
          await addSavedMeal(payload);
          setView({ type: "saved-meals" });
        }}
      />
    );
  }

  if (view.type === "edit-meal") {
    const meal = findSavedMeal(savedMeals, view.mealId);
    if (!meal) {
      return (
        <PageShell title="Meal not found" onBack={() => setView({ type: "saved-meals" })}>
          <p className="text-sm text-zinc-500">This saved meal could not be loaded.</p>
        </PageShell>
      );
    }

    return (
      <NewMealPage
        initialMeal={meal}
        onBack={() => setView({ type: "saved-meals" })}
        onSave={async (payload) => {
          await editSavedMeal(view.mealId, payload);
          setView({ type: "saved-meals" });
        }}
        onDelete={async () => {
          await removeSavedMeal(view.mealId);
          setView({ type: "saved-meals" });
        }}
      />
    );
  }

  if (view.type === "quick-log") {
    const editingEntry = view.entryId
      ? entries.find((entry) => entry.id === view.entryId)
      : undefined;

    return (
      <QuickLogPage
        key={view.entryId ?? "new"}
        logDate={selectedDate}
        isEditing={Boolean(view.entryId)}
        initialEntry={editingEntry}
        onBack={() =>
          setView(view.entryId ? { type: "today" } : { type: "add-food" })
        }
        onConfirm={async (payload) => {
          if (view.entryId) {
            await updateQuickLogEntryById(view.entryId, payload);
          } else {
            await addQuickLogEntry(payload);
          }
          setView({ type: "today" });
        }}
      />
    );
  }

  if (view.type === "log-meal") {
    const editingEntry = view.entryId
      ? entries.find((entry) => entry.id === view.entryId)
      : undefined;

    return (
      <LogMealPage
        key={view.entryId ?? view.mealId}
        meals={savedMeals}
        mealId={view.mealId}
        logDate={selectedDate}
        isEditing={Boolean(view.entryId)}
        initialSlot={editingEntry?.slot}
        initialServings={editingEntry?.servings}
        onBack={() =>
          setView(view.entryId ? { type: "today" } : { type: "saved-meals" })
        }
        onConfirm={async (payload) => {
          if (view.entryId) {
            await updateSavedMealEntry(view.entryId, payload, view.mealId);
          } else {
            await addSavedMealEntry(payload, view.mealId);
          }
          setView({ type: "today" });
        }}
      />
    );
  }

  const nutritionReady = !loadingNutrition && goal !== null;

  return (
    <>
      <AppTopBar
        section={appSection}
        onSectionChange={switchSection}
        onOpenSettings={openSettings}
      />

      <div className={TOP_BAR_OFFSET}>
        {appSection === "nutrition" && !nutritionReady && (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">Loading…</p>
        )}

        {appSection === "nutrition" && nutritionReady && dashboardTab === "day" && (
          <Dashboard
            selectedDate={selectedDate}
            entries={entries}
            goal={goal}
            deleteError={deleteEntryError}
            onDismissDeleteError={() => setDeleteEntryError(null)}
            onDateChange={changeDate}
            onDeleteEntry={handleDeleteEntry}
            onEditEntry={(id) => {
              const entry = entries.find((e) => e.id === id);
              if (!entry) return;
              if (entry.savedMealId) {
                setView({ type: "log-meal", mealId: entry.savedMealId, entryId: id });
              } else {
                setView({ type: "quick-log", entryId: id });
              }
            }}
            onAddFood={
              !isFutureDate(selectedDate) ? () => setView({ type: "add-food" }) : undefined
            }
          />
        )}

        {appSection === "nutrition" && nutritionReady && dashboardTab === "week" && (
          <WeekView
            anchorDate={selectedDate}
            goal={goal}
            entriesVersion={entriesVersion}
            onAnchorChange={changeDate}
            onSelectDate={openDay}
          />
        )}

        {appSection === "nutrition" && nutritionReady && dashboardTab === "month" && (
          <MonthView
            anchorDate={selectedDate}
            goal={goal}
            entriesVersion={entriesVersion}
            onAnchorChange={changeDate}
            onSelectDate={openDay}
          />
        )}

        {appSection === "health" && !HEALTH_SECTION_ENABLED && <HealthUnderConstructionPage />}

        {appSection === "health" && HEALTH_SECTION_ENABLED && dashboardTab === "day" && (
          <HealthDayView selectedDate={selectedDate} onDateChange={changeDate} />
        )}

        {appSection === "health" && HEALTH_SECTION_ENABLED && dashboardTab === "week" && (
          <HealthWeekView
            anchorDate={selectedDate}
            onAnchorChange={changeDate}
            onSelectDate={openDay}
          />
        )}

        {appSection === "health" && HEALTH_SECTION_ENABLED && dashboardTab === "month" && (
          <HealthMonthView
            anchorDate={selectedDate}
            onAnchorChange={changeDate}
            onSelectDate={openDay}
          />
        )}
      </div>

      {(appSection !== "health" || HEALTH_SECTION_ENABLED) && (
        <HomeFooter active={dashboardTab} onChange={setDashboardTab} />
      )}
    </>
  );
}

export default App;
