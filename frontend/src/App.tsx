import { useEffect, useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { AppFlowViews } from "./components/layout/AppFlowViews";
import { MainDashboardShell } from "./components/layout/MainDashboardShell";
import { useAuth } from "./context/useAuth";
import { useCheckInData } from "./hooks/useCheckInData";
import { useEstimateFlow } from "./hooks/useEstimateFlow";
import { useNutritionData } from "./hooks/useNutritionData";
import {
  buildFlowPath,
  dashboardPath,
  defaultDashboardPath,
  parseAppLocation,
  type AppSection,
} from "./lib/appRoutes";
import { toDateKey } from "./lib/dates";
import { isFutureDate } from "./lib/logLabels";
import type { AppView, DashboardTab } from "./types/nutrition";

function App() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const matched = parseAppLocation(location.pathname, location.search);
  const lastDashboardPath = useRef(defaultDashboardPath(toDateKey()));

  useEffect(() => {
    if (!matched) {
      navigate(defaultDashboardPath(toDateKey()), { replace: true });
      return;
    }
    if (matched.kind === "dashboard") {
      lastDashboardPath.current = dashboardPath(
        matched.section,
        matched.period,
        matched.date,
      );
    }
  }, [matched, navigate]);

  const selectedDate =
    matched?.kind === "dashboard"
      ? matched.date
      : matched?.kind === "flow" && matched.date
        ? matched.date
        : toDateKey();

  const appSection: AppSection =
    matched?.kind === "dashboard" ? matched.section : "food";
  const dashboardTab: DashboardTab =
    matched?.kind === "dashboard" ? matched.period : "day";

  const checkInEnabled =
    (matched?.kind === "dashboard" && matched.section === "check-in") ||
    (matched?.kind === "flow" && matched.view.type === "check-in");

  const nutrition = useNutritionData(selectedDate);
  const checkIn = useCheckInData(selectedDate, checkInEnabled);
  const estimate = useEstimateFlow();

  const changeDate = (dateKey: string) => {
    if (isFutureDate(dateKey)) return;
    if (matched?.kind === "dashboard") {
      navigate(dashboardPath(matched.section, matched.period, dateKey));
    }
  };

  const openDay = (dateKey: string) => {
    if (isFutureDate(dateKey)) return;
    const section = matched?.kind === "dashboard" ? matched.section : "food";
    navigate(dashboardPath(section, "day", dateKey));
  };

  const switchSection = (section: AppSection) => {
    navigate(dashboardPath(section, "day", selectedDate));
  };

  const changeDashboardTab = (tab: DashboardTab) => {
    const section = matched?.kind === "dashboard" ? matched.section : "food";
    navigate(dashboardPath(section, tab, selectedDate));
  };

  const openCheckInForm = () => {
    if (isFutureDate(selectedDate)) return;
    navigate(buildFlowPath({ type: "check-in" }, selectedDate));
  };

  const openSettings = () => navigate(buildFlowPath({ type: "goals-settings" }));

  const onViewChange = (view: AppView) => {
    if (view.type === "today") {
      if (matched?.kind === "flow" && matched.view.type === "check-in") {
        navigate(dashboardPath("check-in", "day", selectedDate));
        return;
      }
      const previous = parseAppLocation(lastDashboardPath.current, "");
      if (previous?.kind === "dashboard") {
        navigate(dashboardPath(previous.section, previous.period, selectedDate));
        return;
      }
      navigate(dashboardPath("food", "day", selectedDate));
      return;
    }
    navigate(buildFlowPath(view, selectedDate));
  };

  if (!matched) {
    return <Navigate to={defaultDashboardPath(toDateKey())} replace />;
  }

  if (matched.kind === "flow") {
    if (
      matched.view.type === "estimate-review" &&
      !estimate.estimateSession
    ) {
      return <Navigate to={buildFlowPath({ type: "describe-food" }, selectedDate)} replace />;
    }

    return (
      <AppFlowViews
        view={matched.view}
        selectedDate={selectedDate}
        nutrition={nutrition}
        checkIn={checkIn}
        estimate={estimate}
        onViewChange={onViewChange}
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
      onDashboardTabChange={changeDashboardTab}
      onDateChange={changeDate}
      onOpenDay={openDay}
      onOpenSettings={openSettings}
      onLogout={() => void logout()}
      onViewChange={onViewChange}
      onOpenCheckInForm={openCheckInForm}
    />
  );
}

export default App;
