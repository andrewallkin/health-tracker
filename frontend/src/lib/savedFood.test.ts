import { describe, expect, it } from "vitest";

import type { SavedMeal } from "../types/nutrition";
import { formatAffectedMealNames, getMealsUsingFood } from "./savedFood";

const composedMeal: SavedMeal = {
  id: "meal-1",
  name: "Mince bowl",
  kind: "composed",
  calories: 500,
  protein: 29,
  carbs: 55,
  fat: 16,
  items: [
    {
      foodId: "food-1",
      quantity: 1,
      sortOrder: 0,
      foodName: "Chilli mince",
      calories: 300,
      protein: 25,
      carbs: 10,
      fat: 15,
    },
  ],
};

const manualMeal: SavedMeal = {
  id: "meal-2",
  name: "Shake",
  kind: "manual",
  calories: 200,
  protein: 40,
  carbs: 8,
  fat: 3,
  items: [],
};

describe("getMealsUsingFood", () => {
  it("returns composed meals referencing the food", () => {
    const meals = getMealsUsingFood([composedMeal, manualMeal], "food-1");
    expect(meals).toEqual([composedMeal]);
  });

  it("returns empty when food is unused", () => {
    expect(getMealsUsingFood([composedMeal], "food-99")).toEqual([]);
  });
});

describe("formatAffectedMealNames", () => {
  it("joins meal names for delete confirm copy", () => {
    expect(formatAffectedMealNames([composedMeal])).toBe("Mince bowl");
    expect(formatAffectedMealNames([composedMeal, manualMeal])).toBe("Mince bowl, Shake");
  });
});
