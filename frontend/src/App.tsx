import { useState } from "react";

import { AppFlowViews } from "./components/layout/AppFlowViews";
import { MainDashboardShell } from "./components/layout/MainDashboardShell";
import { useAuth } from "./context/useAuth";
import { useCheckInData } from "./hooks/useCheckInData";
import { useEstimateFlow } from "./hooks/useEstimateFlow";
import { useNutritionData } from "./hooks/useNutritionData";
import { toDateKey } from "./lib/dates";
import { isFutureDate } from "./lib/logLabels";
import type { AppSection } from "./types/health";
import type { AppView, DashboardTab } from "./types/nutrition";

function App() {
  const { logout } = useAuth();
  const [view, setView] = useState<AppView>({ type: "today" });
  const [appSection, setAppSection] = useState<AppSection>("nutrition");
  const [selectedDate, setSelectedDate] = useState(() => toDateKey());
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("day");

  const nutrition = useNutritionData(selectedDate);
  const checkIn = useCheckInData(selectedDate, appSection === "check-in");
  const estimate = useEstimateFlow();

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
    setView({ type: "today" });
  };

  const openCheckInForm = () => {
    if (isFutureDate(selectedDate)) return;
    setView({ type: "check-in" });
  };

  const openSettings = () => setView({ type: "goals-settings" });

  if (view.type !== "today") {
    return (
      <AppFlowViews
        view={view}
        selectedDate={selectedDate}
        nutrition={nutrition}
        checkIn={checkIn}
        estimate={estimate}
        onViewChange={setView}
        onOpenSettings={openSettings}
      />
    );
  }

  return (
    <MainDashboardShell
      appSection={appSection}
      dashboardTab={dashboardTab}
      selectedDate={selectedDate}
      nutrition={nutrition}
      checkIn={checkIn}
      onSectionChange={switchSection}
      onDashboardTabChange={setDashboardTab}
      onDateChange={changeDate}
      onOpenDay={openDay}
      onOpenSettings={openSettings}
      onLogout={() => void logout()}
      onViewChange={setView}
      onOpenCheckInForm={openCheckInForm}
    />
  );
}

export default App;
