import { CheckInDayView } from "../checkin/CheckInDayView";
import { CheckInMonthView } from "../checkin/CheckInMonthView";
import { CheckInWeekView } from "../checkin/CheckInWeekView";
import { HealthUnderConstructionPage } from "../health/HealthUnderConstructionPage";
import { Dashboard } from "../nutrition/dashboard/Dashboard";
import { MonthView } from "../nutrition/dashboard/MonthView";
import { WeekView } from "../nutrition/dashboard/WeekView";
import type { useCheckInData } from "../../hooks/useCheckInData";
import type { useNutritionData } from "../../hooks/useNutritionData";
import { isFutureDate } from "../../lib/logLabels";
import { TOP_BAR_OFFSET } from "../../lib/layout";
import type { AppSection } from "../../types/health";
import type { AppView, DashboardTab } from "../../types/nutrition";
import { AppTopBar } from "./AppTopBar";
import { HomeFooter } from "./HomeFooter";

type NutritionData = ReturnType<typeof useNutritionData>;
type CheckInData = ReturnType<typeof useCheckInData>;

interface MainDashboardShellProps {
  appSection: AppSection;
  dashboardTab: DashboardTab;
  selectedDate: string;
  nutrition: NutritionData;
  checkIn: CheckInData;
  onSectionChange: (section: AppSection) => void;
  onDashboardTabChange: (tab: DashboardTab) => void;
  onDateChange: (dateKey: string) => void;
  onOpenDay: (dateKey: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onViewChange: (view: AppView) => void;
  onOpenCheckInForm: () => void;
}

export function MainDashboardShell({
  appSection,
  dashboardTab,
  selectedDate,
  nutrition,
  checkIn,
  onSectionChange,
  onDashboardTabChange,
  onDateChange,
  onOpenDay,
  onOpenSettings,
  onLogout,
  onViewChange,
  onOpenCheckInForm,
}: MainDashboardShellProps) {
  const {
    entries,
    entriesReloadKey,
    goal,
    loadingNutrition,
    loadError,
    deleteEntryError,
    nutritionReady,
    handleDeleteEntry,
    dismissDeleteEntryError,
    retryBootstrap,
  } = nutrition;

  return (
    <>
      <AppTopBar
        section={appSection}
        onSectionChange={onSectionChange}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
      />

      <div className={TOP_BAR_OFFSET}>
        {appSection === "nutrition" && loadingNutrition && (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">Loading…</p>
        )}

        {appSection === "nutrition" && loadError && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-red-400">{loadError}</p>
            <button
              type="button"
              onClick={retryBootstrap}
              className="mt-3 text-sm font-medium text-white underline"
            >
              Retry
            </button>
          </div>
        )}

        {appSection === "nutrition" && nutritionReady && dashboardTab === "day" && goal && (
          <Dashboard
            selectedDate={selectedDate}
            entries={entries}
            goal={goal}
            deleteError={deleteEntryError}
            onDismissDeleteError={dismissDeleteEntryError}
            onDateChange={onDateChange}
            onDeleteEntry={handleDeleteEntry}
            onEditEntry={(id) => {
              const entry = entries.find((e) => e.id === id);
              if (!entry) return;
              if (entry.savedMealId) {
                onViewChange({ type: "log-meal", mealId: entry.savedMealId, entryId: id });
              } else {
                onViewChange({ type: "quick-log", entryId: id });
              }
            }}
            onAddFood={
              !isFutureDate(selectedDate) ? () => onViewChange({ type: "add-food" }) : undefined
            }
            onOpenLibrary={
              !isFutureDate(selectedDate)
                ? () => onViewChange({ type: "saved-meals", tab: "foods" })
                : undefined
            }
          />
        )}

        {appSection === "nutrition" && nutritionReady && dashboardTab === "week" && goal && (
          <WeekView
            anchorDate={selectedDate}
            goal={goal}
            entriesVersion={entriesReloadKey}
            onAnchorChange={onDateChange}
            onSelectDate={onOpenDay}
          />
        )}

        {appSection === "nutrition" && nutritionReady && dashboardTab === "month" && goal && (
          <MonthView
            anchorDate={selectedDate}
            goal={goal}
            entriesVersion={entriesReloadKey}
            onAnchorChange={onDateChange}
            onSelectDate={onOpenDay}
          />
        )}

        {appSection === "health" && <HealthUnderConstructionPage />}

        {appSection === "check-in" && dashboardTab === "day" && (
          <CheckInDayView
            selectedDate={selectedDate}
            checkIn={checkIn.checkIn}
            checkInLoading={checkIn.loadingCheckIn}
            checkInLoadError={checkIn.checkInLoadError}
            deleteCheckInError={checkIn.deleteCheckInError}
            isDeletingCheckIn={checkIn.isDeletingCheckIn}
            onDateChange={onDateChange}
            onAddCheckIn={onOpenCheckInForm}
            onEditCheckIn={onOpenCheckInForm}
            onDeleteCheckIn={() => void checkIn.handleDeleteCheckIn()}
            onDismissDeleteCheckInError={checkIn.dismissDeleteCheckInError}
          />
        )}

        {appSection === "check-in" && dashboardTab === "week" && (
          <CheckInWeekView
            anchorDate={selectedDate}
            onAnchorChange={onDateChange}
            onSelectDate={onOpenDay}
          />
        )}

        {appSection === "check-in" && dashboardTab === "month" && (
          <CheckInMonthView anchorDate={selectedDate} onAnchorChange={onDateChange} />
        )}
      </div>

      {(appSection === "nutrition" || appSection === "check-in") && (
        <HomeFooter active={dashboardTab} onChange={onDashboardTabChange} />
      )}
    </>
  );
}
