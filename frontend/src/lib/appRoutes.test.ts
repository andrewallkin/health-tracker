import { describe, expect, it } from "vitest";

import {
  buildFlowPath,
  dashboardPath,
  defaultDashboardPath,
  parseAppLocation,
  type AppFlowLocation,
} from "./appRoutes";

describe("dashboardPath", () => {
  it("builds section/period/date paths", () => {
    expect(dashboardPath("food", "day", "2026-07-18")).toBe("/food/day/2026-07-18");
    expect(dashboardPath("activity", "week", "2026-07-13")).toBe("/activity/week/2026-07-13");
    expect(dashboardPath("check-in", "month", "2026-07-01")).toBe("/check-in/month/2026-07-01");
  });
});

describe("buildFlowPath", () => {
  it("builds settings and food flow paths", () => {
    expect(buildFlowPath({ type: "goals-settings" })).toBe("/settings");
    expect(buildFlowPath({ type: "add-food" }, "2026-07-18")).toBe("/food/add?date=2026-07-18");
    expect(buildFlowPath({ type: "saved-meals", tab: "foods" })).toBe("/food/saved?tab=foods");
    expect(buildFlowPath({ type: "saved-meals", tab: "meals" })).toBe("/food/saved?tab=meals");
    expect(buildFlowPath({ type: "new-meal" })).toBe("/food/meals/new");
    expect(buildFlowPath({ type: "edit-meal", mealId: "m1" })).toBe("/food/meals/m1/edit");
    expect(buildFlowPath({ type: "new-food" })).toBe("/food/foods/new");
    expect(buildFlowPath({ type: "edit-food", foodId: "f1" })).toBe("/food/foods/f1/edit");
    expect(buildFlowPath({ type: "describe-food" }, "2026-07-18")).toBe(
      "/food/estimate?date=2026-07-18",
    );
    expect(buildFlowPath({ type: "estimate-review" }, "2026-07-18")).toBe(
      "/food/estimate/review?date=2026-07-18",
    );
    expect(buildFlowPath({ type: "quick-log" }, "2026-07-18")).toBe(
      "/food/quick-log?date=2026-07-18",
    );
    expect(buildFlowPath({ type: "quick-log", entryId: "e1" }, "2026-07-18")).toBe(
      "/food/quick-log/e1?date=2026-07-18",
    );
    expect(buildFlowPath({ type: "log-meal", mealId: "m1" }, "2026-07-18")).toBe(
      "/food/log/meal/m1?date=2026-07-18",
    );
    expect(buildFlowPath({ type: "log-meal", mealId: "m1", entryId: "e1" }, "2026-07-18")).toBe(
      "/food/log/meal/m1?date=2026-07-18&entryId=e1",
    );
    expect(buildFlowPath({ type: "log-food", foodId: "f1" }, "2026-07-18")).toBe(
      "/food/log/food/f1?date=2026-07-18",
    );
    expect(buildFlowPath({ type: "check-in" }, "2026-07-18")).toBe(
      "/check-in/entry?date=2026-07-18",
    );
    expect(buildFlowPath({ type: "check-in", checkInId: "c1" }, "2026-07-18")).toBe(
      "/check-in/entry/c1?date=2026-07-18",
    );
  });

  it("threads working date through library, create/edit, and settings flows", () => {
    expect(buildFlowPath({ type: "goals-settings" }, "2026-07-10")).toBe(
      "/settings?date=2026-07-10",
    );
    expect(buildFlowPath({ type: "saved-meals", tab: "foods" }, "2026-07-10")).toBe(
      "/food/saved?tab=foods&date=2026-07-10",
    );
    expect(buildFlowPath({ type: "saved-meals", tab: "meals" }, "2026-07-10")).toBe(
      "/food/saved?tab=meals&date=2026-07-10",
    );
    expect(buildFlowPath({ type: "new-meal" }, "2026-07-10")).toBe(
      "/food/meals/new?date=2026-07-10",
    );
    expect(buildFlowPath({ type: "edit-meal", mealId: "m1" }, "2026-07-10")).toBe(
      "/food/meals/m1/edit?date=2026-07-10",
    );
    expect(buildFlowPath({ type: "new-food" }, "2026-07-10")).toBe(
      "/food/foods/new?date=2026-07-10",
    );
    expect(buildFlowPath({ type: "edit-food", foodId: "f1" }, "2026-07-10")).toBe(
      "/food/foods/f1/edit?date=2026-07-10",
    );
  });
});

describe("parseAppLocation", () => {
  it("parses dashboard locations", () => {
    expect(parseAppLocation("/food/day/2026-07-18", "")).toEqual({
      kind: "dashboard",
      section: "food",
      period: "day",
      date: "2026-07-18",
    });
    expect(parseAppLocation("/activity/week/2026-07-13", "")).toEqual({
      kind: "dashboard",
      section: "activity",
      period: "week",
      date: "2026-07-13",
    });
  });

  it("parses flow locations and date query", () => {
    expect(parseAppLocation("/settings", "")).toEqual({
      kind: "flow",
      view: { type: "goals-settings" },
      date: null,
    } satisfies AppFlowLocation);

    expect(parseAppLocation("/settings", "date=2026-07-10")).toEqual({
      kind: "flow",
      view: { type: "goals-settings" },
      date: "2026-07-10",
    });

    expect(parseAppLocation("/food/add", "date=2026-07-18")).toEqual({
      kind: "flow",
      view: { type: "add-food" },
      date: "2026-07-18",
    });

    expect(parseAppLocation("/food/saved", "tab=meals")).toEqual({
      kind: "flow",
      view: { type: "saved-meals", tab: "meals" },
      date: null,
    });

    expect(parseAppLocation("/food/saved", "tab=foods&date=2026-07-10")).toEqual({
      kind: "flow",
      view: { type: "saved-meals", tab: "foods" },
      date: "2026-07-10",
    });

    expect(parseAppLocation("/food/meals/new", "date=2026-07-10")).toEqual({
      kind: "flow",
      view: { type: "new-meal" },
      date: "2026-07-10",
    });

    expect(parseAppLocation("/food/foods/f1/edit", "date=2026-07-10")).toEqual({
      kind: "flow",
      view: { type: "edit-food", foodId: "f1" },
      date: "2026-07-10",
    });

    expect(parseAppLocation("/food/log/meal/m1", "date=2026-07-18&entryId=e1")).toEqual({
      kind: "flow",
      view: { type: "log-meal", mealId: "m1", entryId: "e1" },
      date: "2026-07-18",
    });

    expect(parseAppLocation("/check-in/entry/c1", "date=2026-07-18")).toEqual({
      kind: "flow",
      view: { type: "check-in", checkInId: "c1" },
      date: "2026-07-18",
    });
  });

  it("returns null for invalid paths", () => {
    expect(parseAppLocation("/", "")).toBeNull();
    expect(parseAppLocation("/food/day", "")).toBeNull();
    expect(parseAppLocation("/food/day/not-a-date", "")).toBeNull();
    expect(parseAppLocation("/unknown", "")).toBeNull();
  });
});

describe("defaultDashboardPath", () => {
  it("points at food day for a given date", () => {
    expect(defaultDashboardPath("2026-07-18")).toBe("/food/day/2026-07-18");
  });
});
