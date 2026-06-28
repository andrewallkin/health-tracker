import { describe, expect, it } from "vitest";

import type { SavedFood } from "../types/nutrition";
import { sumFoodComponents } from "./composeFoods";

const mince: SavedFood = {
  id: "1",
  name: "Chilli mince",
  calories: 300,
  protein: 25,
  carbs: 10,
  fat: 15,
};

const rice: SavedFood = {
  id: "2",
  name: "Rice",
  calories: 200,
  protein: 4,
  carbs: 45,
  fat: 1,
};

describe("sumFoodComponents", () => {
  it("sums scaled macros from multiple foods", () => {
    const total = sumFoodComponents([mince, rice], [
      { foodId: "1", quantity: 1 },
      { foodId: "2", quantity: 1 },
    ]);
    expect(total).toEqual({
      calories: 500,
      protein: 29,
      carbs: 55,
      fat: 16,
    });
  });

  it("applies quantity multipliers", () => {
    const total = sumFoodComponents([rice], [{ foodId: "2", quantity: 2 }]);
    expect(total).toEqual({
      calories: 400,
      protein: 8,
      carbs: 90,
      fat: 2,
    });
  });

  it("ignores unknown food ids", () => {
    const total = sumFoodComponents([mince], [{ foodId: "missing", quantity: 1 }]);
    expect(total).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});
