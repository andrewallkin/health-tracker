import { afterEach, describe, expect, it, vi } from "vitest";

import type { SavedFood, SavedMeal } from "../types/nutrition";
import { buildLogEntryFromSavedMeal, buildQuickLogPayloadFromSavedFood } from "./logEntry";

const meal: SavedMeal = {
  id: "meal-1",
  name: "Chicken bowl",
  kind: "manual",
  calories: 400,
  protein: 30,
  carbs: 40,
  fat: 10,
  imageUrl: "/api/photos/meal.jpg",
  items: [],
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
    expect(entry.imageUrl).toBeUndefined();
    expect(entry.calories).toBe(800);
    expect(entry.protein).toBe(60);
    expect(entry.carbs).toBe(80);
    expect(entry.fat).toBe(20);
  });
});

const food: SavedFood = {
  id: "food-1",
  name: "Orange",
  calories: 62,
  protein: 1,
  carbs: 15,
  fat: 0,
};

describe("buildQuickLogPayloadFromSavedFood", () => {
  it("scales macros and copies food name", () => {
    const payload = buildQuickLogPayloadFromSavedFood(food, { slot: "snack", portions: 2 });

    expect(payload.name).toBe("Orange");
    expect(payload.slot).toBe("snack");
    expect(payload.calories).toBe(124);
    expect(payload.protein).toBe(2);
    expect(payload.carbs).toBe(30);
    expect(payload.fat).toBe(0);
  });
});
