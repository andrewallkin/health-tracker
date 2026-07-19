import type { AppSection } from "../types/health";
import type { AppView, DashboardTab } from "../types/nutrition";

export type { AppSection };

export type AppDashboardLocation = {
  kind: "dashboard";
  section: AppSection;
  period: DashboardTab;
  date: string;
};

export type AppFlowLocation = {
  kind: "flow";
  view: Exclude<AppView, { type: "today" }>;
  date: string | null;
};

export type AppLocation = AppDashboardLocation | AppFlowLocation;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SECTIONS = new Set<AppSection>(["food", "activity", "check-in"]);
const PERIODS = new Set<DashboardTab>(["day", "week", "month"]);

function isDateKey(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

export function dashboardPath(section: AppSection, period: DashboardTab, date: string): string {
  return `/${section}/${period}/${date}`;
}

export function defaultDashboardPath(date: string): string {
  return dashboardPath("food", "day", date);
}

export function buildFlowPath(
  view: Exclude<AppView, { type: "today" }>,
  date?: string,
): string {
  switch (view.type) {
    case "goals-settings":
      return withQuery("/settings", { date });
    case "add-food":
      return withQuery("/food/add", { date });
    case "saved-meals":
      return withQuery("/food/saved", { tab: view.tab ?? "foods", date });
    case "new-meal":
      return withQuery("/food/meals/new", { date });
    case "edit-meal":
      return withQuery(`/food/meals/${view.mealId}/edit`, { date });
    case "new-food":
      return withQuery("/food/foods/new", { date });
    case "edit-food":
      return withQuery(`/food/foods/${view.foodId}/edit`, { date });
    case "describe-food":
      return withQuery("/food/estimate", { date });
    case "estimate-review":
      return withQuery("/food/estimate/review", { date });
    case "quick-log":
      return view.entryId
        ? withQuery(`/food/quick-log/${view.entryId}`, { date })
        : withQuery("/food/quick-log", { date });
    case "log-meal":
      return withQuery(`/food/log/meal/${view.mealId}`, {
        date,
        entryId: view.entryId,
      });
    case "log-food":
      return withQuery(`/food/log/food/${view.foodId}`, { date });
    case "check-in":
      return view.checkInId
        ? withQuery(`/check-in/entry/${view.checkInId}`, { date })
        : withQuery("/check-in/entry", { date });
  }
}

function parseSearch(search: string): URLSearchParams {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw);
}

export function parseAppLocation(pathname: string, search: string): AppLocation | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const params = parseSearch(search);
  const dateParam = params.get("date");
  const date = dateParam && isDateKey(dateParam) ? dateParam : null;

  if (path === "/settings") {
    return { kind: "flow", view: { type: "goals-settings" }, date };
  }

  if (path === "/food/add") {
    return { kind: "flow", view: { type: "add-food" }, date };
  }

  if (path === "/food/saved") {
    const tab = params.get("tab") === "meals" ? "meals" : "foods";
    return { kind: "flow", view: { type: "saved-meals", tab }, date };
  }

  if (path === "/food/meals/new") {
    return { kind: "flow", view: { type: "new-meal" }, date };
  }

  const editMeal = path.match(/^\/food\/meals\/([^/]+)\/edit$/);
  if (editMeal) {
    return { kind: "flow", view: { type: "edit-meal", mealId: editMeal[1] }, date };
  }

  if (path === "/food/foods/new") {
    return { kind: "flow", view: { type: "new-food" }, date };
  }

  const editFood = path.match(/^\/food\/foods\/([^/]+)\/edit$/);
  if (editFood) {
    return { kind: "flow", view: { type: "edit-food", foodId: editFood[1] }, date };
  }

  if (path === "/food/estimate") {
    return { kind: "flow", view: { type: "describe-food" }, date };
  }

  if (path === "/food/estimate/review") {
    return { kind: "flow", view: { type: "estimate-review" }, date };
  }

  const quickLogEntry = path.match(/^\/food\/quick-log\/([^/]+)$/);
  if (quickLogEntry) {
    return {
      kind: "flow",
      view: { type: "quick-log", entryId: quickLogEntry[1] },
      date,
    };
  }

  if (path === "/food/quick-log") {
    return { kind: "flow", view: { type: "quick-log" }, date };
  }

  const logMeal = path.match(/^\/food\/log\/meal\/([^/]+)$/);
  if (logMeal) {
    const entryId = params.get("entryId") ?? undefined;
    return {
      kind: "flow",
      view: { type: "log-meal", mealId: logMeal[1], entryId },
      date,
    };
  }

  const logFood = path.match(/^\/food\/log\/food\/([^/]+)$/);
  if (logFood) {
    return { kind: "flow", view: { type: "log-food", foodId: logFood[1] }, date };
  }

  const checkInEntry = path.match(/^\/check-in\/entry(?:\/([^/]+))?$/);
  if (checkInEntry) {
    return {
      kind: "flow",
      view: { type: "check-in", checkInId: checkInEntry[1] },
      date,
    };
  }

  const dashboard = path.match(/^\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (dashboard) {
    const section = dashboard[1];
    const period = dashboard[2];
    const dateKey = dashboard[3];
    if (
      SECTIONS.has(section as AppSection) &&
      PERIODS.has(period as DashboardTab) &&
      isDateKey(dateKey)
    ) {
      return {
        kind: "dashboard",
        section: section as AppSection,
        period: period as DashboardTab,
        date: dateKey,
      };
    }
  }

  return null;
}
