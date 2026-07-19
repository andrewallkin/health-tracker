import { describe, expect, it, vi } from "vitest";

import { finishEstimateConfirm, viewAfterEstimateConfirm } from "./estimateNavigation";

describe("viewAfterEstimateConfirm", () => {
  it("returns today when addToDay is set", () => {
    expect(
      viewAfterEstimateConfirm({ addToDay: true, saveAsMeal: false, saveAsFood: false }),
    ).toEqual({ type: "today" });
  });

  it("prefers today over library tabs when addToDay is set", () => {
    expect(
      viewAfterEstimateConfirm({ addToDay: true, saveAsMeal: true, saveAsFood: true }),
    ).toEqual({ type: "today" });
  });

  it("returns foods library when saving food without addToDay", () => {
    expect(
      viewAfterEstimateConfirm({ addToDay: false, saveAsMeal: false, saveAsFood: true }),
    ).toEqual({ type: "saved-meals", tab: "foods" });
  });

  it("returns meals library when saving meal without addToDay", () => {
    expect(
      viewAfterEstimateConfirm({ addToDay: false, saveAsMeal: true, saveAsFood: false }),
    ).toEqual({ type: "saved-meals", tab: "meals" });
  });
});

describe("finishEstimateConfirm", () => {
  it("navigates away before clearing the estimate session", () => {
    const calls: string[] = [];
    const onViewChange = vi.fn(() => {
      calls.push("navigate");
    });
    const clearEstimateSession = vi.fn(() => {
      calls.push("clear");
    });

    finishEstimateConfirm({
      options: { addToDay: true, saveAsMeal: false, saveAsFood: false },
      onViewChange,
      clearEstimateSession,
    });

    expect(calls).toEqual(["navigate", "clear"]);
    expect(onViewChange).toHaveBeenCalledWith({ type: "today" });
    expect(clearEstimateSession).toHaveBeenCalledOnce();
  });

  it("navigates to foods library before clear when only saveAsFood", () => {
    const calls: string[] = [];
    finishEstimateConfirm({
      options: { addToDay: false, saveAsMeal: false, saveAsFood: true },
      onViewChange: () => {
        calls.push("navigate");
      },
      clearEstimateSession: () => {
        calls.push("clear");
      },
    });

    expect(calls).toEqual(["navigate", "clear"]);
  });
});
