import { afterEach, describe, expect, it, vi } from "vitest";

import type { SavedMeal } from "../types/nutrition";
import { buildLogEntryFromSavedMeal } from "./logEntry";

const meal: SavedMeal = {
  id: "meal-1",
  name: "Chicken bowl",
  calories: 400,
  protein: 30,
  carbs: 40,
  fat: 10,
  imageUrl: "/api/photos/meal.jpg",
};

describe("buildLogEntryFromSavedMeal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scales macros and copies meal metadata", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-entry-id" });
    vi.spyOn(Date.prototype, "toLocaleTimeString").mockReturnValue("12:30");

    const entry = buildLogEntryFromSavedMeal(meal, { slot: "lunch", servings: 2 });

    expect(entry.id).toBe("fixed-entry-id");
    expect(entry.name).toBe("Chicken bowl");
    expect(entry.slot).toBe("lunch");
    expect(entry.servings).toBe(2);
    expect(entry.time).toBe("12:30");
    expect(entry.savedMealId).toBe("meal-1");
    expect(entry.imageUrl).toBe("/api/photos/meal.jpg");
    expect(entry.calories).toBe(800);
    expect(entry.protein).toBe(60);
    expect(entry.carbs).toBe(80);
    expect(entry.fat).toBe(20);
  });
});
