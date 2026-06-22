import { useEffect, useState } from "react";
import { dailyGoal } from "./data/mock";
import { toDateKey } from "./lib/dates";
import { isFutureDate } from "./lib/logLabels";
import { buildLogEntryFromSavedMeal, type LogMealPayload } from "./lib/logEntry";
import {
  buildQuickLogEntry,
  type QuickLogPayload,
  updateQuickLogEntry,
} from "./lib/quickLog";
import { buildSavedMeal, findSavedMeal, type NewSavedMealPayload } from "./lib/savedMeal";
import {
  loadDailyGoal,
  loadEntries,
  loadSavedMeals,
  saveDailyGoal,
  saveEntries,
  saveSavedMeals,
} from "./lib/storage";
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
import { GoalsSettingsPage } from "./components/nutrition/pages/GoalsSettingsPage";
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
  const [entries, setEntries] = useState<LogEntry[]>(() => loadEntries(toDateKey()));
  const [goal, setGoal] = useState<DailyGoal>(() => loadDailyGoal(dailyGoal));
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>(loadSavedMeals);
  const [estimateSession, setEstimateSession] = useState<EstimateSession | null>(null);

  useEffect(() => {
    saveEntries(selectedDate, entries);
  }, [entries, selectedDate]);

  useEffect(() => {
    saveDailyGoal(goal);
  }, [goal]);

  useEffect(() => {
    saveSavedMeals(savedMeals);
  }, [savedMeals]);

  const changeDate = (dateKey: string) => {
    if (isFutureDate(dateKey)) return;
    setSelectedDate(dateKey);
    setEntries(loadEntries(dateKey));
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

  const addSavedMealEntry = (payload: LogMealPayload, mealId: string) => {
    const meal = findSavedMeal(savedMeals, mealId);
    if (!meal) return;
    setEntries((prev) => [...prev, buildLogEntryFromSavedMeal(meal, payload)]);
  };

  const updateSavedMealEntry = (
    entryId: string,
    payload: LogMealPayload,
    mealId: string,
  ) => {
    const meal = findSavedMeal(savedMeals, mealId);
    if (!meal) return;
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry;
        return {
          ...buildLogEntryFromSavedMeal(meal, payload),
          id: entryId,
          time: entry.time,
        };
      }),
    );
  };

  const addQuickLogEntry = (payload: QuickLogPayload) => {
    setEntries((prev) => [...prev, buildQuickLogEntry(payload)]);
  };

  const updateQuickLogEntryById = (entryId: string, payload: QuickLogPayload) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? updateQuickLogEntry(entry, payload) : entry,
      ),
    );
  };

  const addSavedMeal = (payload: NewSavedMealPayload) => {
    setSavedMeals((prev) => [...prev, buildSavedMeal(payload)]);
  };

  if (view.type === "goals-settings") {
    return (
      <GoalsSettingsPage
        initialGoal={goal}
        onBack={() => setView({ type: "today" })}
        onSave={(updated) => {
          setGoal(updated);
          setView({ type: "today" });
        }}
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
        onConfirm={(payload, { addToDay, saveAsMeal }) => {
          if (saveAsMeal) addSavedMeal(reviewedToSavedMeal(payload));
          if (addToDay) addQuickLogEntry(reviewedToQuickLog(payload));
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
        onSave={(payload) => {
          addSavedMeal(payload);
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
        onConfirm={(payload) => {
          if (view.entryId) {
            updateQuickLogEntryById(view.entryId, payload);
          } else {
            addQuickLogEntry(payload);
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
        onConfirm={(payload) => {
          if (view.entryId) {
            updateSavedMealEntry(view.entryId, payload, view.mealId);
          } else {
            addSavedMealEntry(payload, view.mealId);
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
          <Dashboard
            selectedDate={selectedDate}
            entries={entries}
            goal={goal}
            onDateChange={changeDate}
            onOpenSettings={() => setView({ type: "goals-settings" })}
            onDeleteEntry={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
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
