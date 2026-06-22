import { useEffect, useState } from "react";
import { dailyGoal } from "./data/mock";
import {
  createLogEntry,
  createSavedMeal,
  deleteLogEntry,
  fetchEntriesForDate,
  fetchGoals,
  fetchSavedMeals,
  updateAiSettings,
  updateGoals,
  updateLogEntry,
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
import { HealthWeekView } from "./components/health/HealthWeekView";
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
  const [goal, setGoal] = useState<DailyGoal>(dailyGoal);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [estimateSession, setEstimateSession] = useState<EstimateSession | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchGoals(), fetchSavedMeals()])
      .then(([loadedGoal, meals]) => {
        if (!cancelled) {
          setGoal(loadedGoal);
          setSavedMeals(meals);
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
  }, [selectedDate]);

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

  const addSavedMealEntry = async (payload: LogMealPayload, mealId: string) => {
    const meal = findSavedMeal(savedMeals, mealId);
    if (!meal) return;
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
    });
    setEntries((prev) => [...prev, created]);
  };

  const updateSavedMealEntry = async (
    entryId: string,
    payload: LogMealPayload,
    mealId: string,
  ) => {
    const meal = findSavedMeal(savedMeals, mealId);
    if (!meal) return;
    const existing = entries.find((entry) => entry.id === entryId);
    if (!existing) return;
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
    });
    setEntries((prev) => prev.map((entry) => (entry.id === entryId ? updated : entry)));
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
    });
    setEntries((prev) => [...prev, created]);
  };

  const updateQuickLogEntryById = async (entryId: string, payload: QuickLogPayload) => {
    const existing = entries.find((entry) => entry.id === entryId);
    if (!existing) return;
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
  };

  const addSavedMeal = async (payload: NewSavedMealPayload) => {
    const created = await createSavedMeal(payload);
    setSavedMeals((prev) => [...prev, created]);
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteLogEntry(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleSaveSettings = async ({ goal: updatedGoal, ai }: SettingsSavePayload) => {
    const [savedGoal] = await Promise.all([
      updateGoals(updatedGoal),
      updateAiSettings(ai),
    ]);
    setGoal(savedGoal);
    setView({ type: "today" });
  };

  if (view.type === "goals-settings") {
    return (
      <GoalsSettingsPage
        initialGoal={goal}
        onBack={() => setView({ type: "today" })}
        onSave={handleSaveSettings}
      />
    );
  }

  if (view.type === "add-food") {
    return (
      <AddFoodHubPage
        onBack={() => setView({ type: "today" })}
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
        onBack={() => {
          setEstimateSession(null);
          setView({ type: "add-food" });
        }}
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
          onBack={() => setView({ type: "add-food" })}
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

  return (
    <>
      <AppTopBar section={appSection} onSectionChange={switchSection} />

      <div className={TOP_BAR_OFFSET}>
        {appSection === "nutrition" && dashboardTab === "day" && (
          loadingNutrition ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">Loading…</p>
          ) : (
            <Dashboard
              selectedDate={selectedDate}
              entries={entries}
              goal={goal}
              onDateChange={changeDate}
              onOpenSettings={() => setView({ type: "goals-settings" })}
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
            />
          )
        )}

        {appSection === "nutrition" && dashboardTab === "week" && (
          <WeekView
            anchorDate={selectedDate}
            goal={goal}
            onAnchorChange={changeDate}
            onSelectDate={openDay}
            onOpenSettings={() => setView({ type: "goals-settings" })}
          />
        )}

        {appSection === "nutrition" && dashboardTab === "month" && (
          <MonthView
            anchorDate={selectedDate}
            goal={goal}
            onAnchorChange={changeDate}
            onSelectDate={openDay}
            onOpenSettings={() => setView({ type: "goals-settings" })}
          />
        )}

        {appSection === "health" && dashboardTab === "day" && (
          <HealthDayView selectedDate={selectedDate} onDateChange={changeDate} />
        )}

        {appSection === "health" && dashboardTab === "week" && (
          <HealthWeekView
            anchorDate={selectedDate}
            onAnchorChange={changeDate}
            onSelectDate={openDay}
          />
        )}

        {appSection === "health" && dashboardTab === "month" && (
          <HealthMonthView
            anchorDate={selectedDate}
            onAnchorChange={changeDate}
            onSelectDate={openDay}
          />
        )}
      </div>

      <HomeFooter
        active={dashboardTab}
        onChange={setDashboardTab}
        onAddFood={
          appSection === "nutrition" && !isFutureDate(selectedDate)
            ? () => setView({ type: "add-food" })
            : undefined
        }
      />
    </>
  );
}

export default App;
