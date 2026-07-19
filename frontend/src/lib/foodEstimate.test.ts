import { describe, expect, it } from "vitest";
import { reviewedToSavedFood } from "./foodEstimate";
import type { ReviewedFoodPayload } from "../types/foodEstimate";

const payload: ReviewedFoodPayload = {
  name: "Oat latte",
  slot: "breakfast",
  calories: 200,
  protein: 5,
  carbs: 25,
  fat: 8,
  description: "Grande",
  imageUrl: undefined,
};

describe("reviewedToSavedFood", () => {
  it("maps macros without tags", () => {
    const result = reviewedToSavedFood(payload);
    expect(result).toEqual({
      name: "Oat latte",
      description: "Grande",
      imageUrl: undefined,
      calories: 200,
      protein: 5,
      carbs: 25,
      fat: 8,
    });
    expect(Object.hasOwn(result, "tags")).toBe(false);
  });
});
