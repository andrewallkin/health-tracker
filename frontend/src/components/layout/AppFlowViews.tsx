import { CheckInPage } from "../health/pages/CheckInPage";
import { AddFoodHubPage } from "../nutrition/pages/AddFoodHubPage";
import { DescribeFoodPage } from "../nutrition/pages/DescribeFoodPage";
import { EstimateReviewPage } from "../nutrition/pages/EstimateReviewPage";
import { GoalsSettingsPage } from "../nutrition/pages/GoalsSettingsPage";
import { LogMealPage } from "../nutrition/pages/LogMealPage";
import { NewFoodPage } from "../nutrition/pages/NewFoodPage";
import { NewMealPage } from "../nutrition/pages/NewMealPage";
import { QuickLogPage } from "../nutrition/pages/QuickLogPage";
import { SavedMealsPage } from "../nutrition/pages/SavedMealsPage";
import type { useCheckInData } from "../../hooks/useCheckInData";
import type { useEstimateFlow } from "../../hooks/useEstimateFlow";
import type { useNutritionData } from "../../hooks/useNutritionData";
import { reviewedToQuickLog, reviewedToSavedFood, reviewedToSavedMeal } from "../../lib/foodEstimate";
import { isFutureDate } from "../../lib/logLabels";
import { findSavedFood } from "../../lib/savedFood";
import { findSavedMeal } from "../../lib/savedMeal";
import type { AppView } from "../../types/nutrition";
import { PageShell } from "./PageShell";

type NutritionData = ReturnType<typeof useNutritionData>;
type CheckInData = ReturnType<typeof useCheckInData>;
type EstimateFlow = ReturnType<typeof useEstimateFlow>;

interface AppFlowViewsProps {
  view: AppView;
  selectedDate: string;
  nutrition: NutritionData;
  checkIn: CheckInData;
  estimate: EstimateFlow;
  onViewChange: (view: AppView) => void;
  onOpenSettings: () => void;
}

export function AppFlowViews({
  view,
  selectedDate,
  nutrition,
  checkIn,
  estimate,
  onViewChange,
  onOpenSettings,
}: AppFlowViewsProps) {
  const {
    goal,
    savedMeals,
    savedFoods,
    entries,
    hasApiKey,
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
    handleSaveSettings,
    setHasApiKey,
  } = nutrition;

  const { estimateSession, clearEstimateSession, startEstimateReview } = estimate;

  if (view.type === "check-in") {
    if (isFutureDate(selectedDate)) {
      return (
        <PageShell title="Check-in" onBack={() => onViewChange({ type: "today" })}>
          <p className="text-sm text-zinc-500">Cannot add check-ins for future dates.</p>
        </PageShell>
      );
    }

    return (
      <CheckInPage
        checkInDate={selectedDate}
        initialCheckIn={checkIn.checkIn ?? undefined}
        onBack={() => onViewChange({ type: "today" })}
        onConfirm={async (payload) => {
          await checkIn.handleSaveCheckIn(payload);
          onViewChange({ type: "today" });
        }}
      />
    );
  }

  if (view.type === "goals-settings") {
    if (!goal) {
      return <p className="px-4 py-8 text-center text-sm text-zinc-500">Loading…</p>;
    }

    return (
      <GoalsSettingsPage
        initialGoal={goal}
        onBack={() => onViewChange({ type: "today" })}
        onSave={async (payload) => {
          await handleSaveSettings(payload);
          onViewChange({ type: "today" });
        }}
        onApiKeyChange={setHasApiKey}
      />
    );
  }

  if (view.type === "add-food") {
    return (
      <AddFoodHubPage
        hasApiKey={hasApiKey}
        onBack={() => onViewChange({ type: "today" })}
        onOpenSettings={onOpenSettings}
        onSelect={(option) => {
          if (option === "saved-meals") {
            onViewChange({ type: "saved-meals", tab: "foods" });
          } else if (option === "quick-log") {
            onViewChange({ type: "quick-log" });
          } else if (option === "describe-photo") {
            onViewChange({ type: "describe-food" });
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
          clearEstimateSession();
          onViewChange({ type: "add-food" });
        }}
        onOpenSettings={onOpenSettings}
        onEstimated={(input, foodEstimate) => {
          startEstimateReview(input, foodEstimate);
          onViewChange({ type: "estimate-review" });
        }}
      />
    );
  }

  if (view.type === "estimate-review") {
    if (!estimateSession) {
      return (
        <DescribeFoodPage
          hasApiKey={hasApiKey}
          onBack={() => onViewChange({ type: "add-food" })}
          onOpenSettings={onOpenSettings}
          onEstimated={(input, foodEstimate) => {
            startEstimateReview(input, foodEstimate);
            onViewChange({ type: "estimate-review" });
          }}
        />
      );
    }

    return (
      <EstimateReviewPage
        input={estimateSession.input}
        estimate={estimateSession.estimate}
        logDate={selectedDate}
        onBack={() => onViewChange({ type: "describe-food" })}
        onConfirm={async (payload, { addToDay, saveAsMeal, saveAsFood, foodTags }) => {
          if (saveAsFood) await addSavedFood(reviewedToSavedFood(payload, foodTags));
          if (saveAsMeal) await addSavedMeal(reviewedToSavedMeal(payload));
          if (addToDay) await addQuickLogEntry(reviewedToQuickLog(payload));
          clearEstimateSession();
          if (addToDay) {
            onViewChange({ type: "today" });
          } else if (saveAsFood) {
            onViewChange({ type: "saved-meals", tab: "foods" });
          } else {
            onViewChange({ type: "saved-meals", tab: "meals" });
          }
        }}
      />
    );
  }

  if (view.type === "saved-meals") {
    return (
      <SavedMealsPage
        key={view.tab ?? "foods"}
        meals={savedMeals}
        foods={savedFoods}
        initialTab={view.tab}
        onBack={() => onViewChange({ type: "today" })}
        onCreateNewMeal={() => onViewChange({ type: "new-meal" })}
        onCreateNewFood={() => onViewChange({ type: "new-food" })}
        onSelectMeal={(mealId) => onViewChange({ type: "log-meal", mealId })}
        onEditMeal={(mealId) => onViewChange({ type: "edit-meal", mealId })}
        onEditFood={(foodId) => onViewChange({ type: "edit-food", foodId })}
      />
    );
  }

  if (view.type === "new-food") {
    return (
      <NewFoodPage
        onBack={() => onViewChange({ type: "saved-meals", tab: "foods" })}
        onSave={async (payload) => {
          await addSavedFood(payload);
          onViewChange({ type: "saved-meals", tab: "foods" });
        }}
      />
    );
  }

  if (view.type === "edit-food") {
    const food = findSavedFood(savedFoods, view.foodId);
    if (!food) {
      return (
        <PageShell title="Food not found" onBack={() => onViewChange({ type: "saved-meals", tab: "foods" })}>
          <p className="text-sm text-zinc-500">This saved food could not be loaded.</p>
        </PageShell>
      );
    }

    return (
      <NewFoodPage
        initialFood={food}
        onBack={() => onViewChange({ type: "saved-meals", tab: "foods" })}
        onSave={async (payload) => {
          await editSavedFood(view.foodId, payload);
          onViewChange({ type: "saved-meals", tab: "foods" });
        }}
        onDelete={async () => {
          await removeSavedFood(view.foodId);
          onViewChange({ type: "saved-meals", tab: "foods" });
        }}
      />
    );
  }

  if (view.type === "new-meal") {
    return (
      <NewMealPage
        savedFoods={savedFoods}
        onBack={() => onViewChange({ type: "saved-meals", tab: "meals" })}
        onManageFoods={() => onViewChange({ type: "saved-meals", tab: "foods" })}
        onSave={async (payload) => {
          await addSavedMeal(payload);
          onViewChange({ type: "saved-meals", tab: "meals" });
        }}
      />
    );
  }

  if (view.type === "edit-meal") {
    const meal = findSavedMeal(savedMeals, view.mealId);
    if (!meal) {
      return (
        <PageShell title="Meal not found" onBack={() => onViewChange({ type: "saved-meals", tab: "meals" })}>
          <p className="text-sm text-zinc-500">This saved meal could not be loaded.</p>
        </PageShell>
      );
    }

    return (
      <NewMealPage
        savedFoods={savedFoods}
        initialMeal={meal}
        onBack={() => onViewChange({ type: "saved-meals", tab: "meals" })}
        onManageFoods={() => onViewChange({ type: "saved-meals", tab: "foods" })}
        onSave={async (payload) => {
          await editSavedMeal(view.mealId, payload);
          onViewChange({ type: "saved-meals", tab: "meals" });
        }}
        onDelete={async () => {
          await removeSavedMeal(view.mealId);
          onViewChange({ type: "saved-meals", tab: "meals" });
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
        savedFoods={savedFoods}
        isEditing={Boolean(view.entryId)}
        initialEntry={editingEntry}
        onBack={() => onViewChange(view.entryId ? { type: "today" } : { type: "add-food" })}
        onManageFoods={() => onViewChange({ type: "saved-meals", tab: "foods" })}
        onConfirm={async (payload) => {
          if (view.entryId) {
            await updateQuickLogEntryById(view.entryId, payload);
          } else {
            await addQuickLogEntry(payload);
          }
          onViewChange({ type: "today" });
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
          onViewChange(view.entryId ? { type: "today" } : { type: "saved-meals", tab: "meals" })
        }
        onConfirm={async (payload) => {
          if (view.entryId) {
            await updateSavedMealEntry(view.entryId, payload, view.mealId);
          } else {
            await addSavedMealEntry(payload, view.mealId);
          }
          onViewChange({ type: "today" });
        }}
      />
    );
  }

  return null;
}
