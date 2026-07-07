import { describe, expect, it } from "vitest";

import { KJ_TO_KCAL_FACTOR, kjToKcal, kcalToKj } from "./energyConversion";

describe("energyConversion", () => {
  it("uses the same factor as the backend food estimator", () => {
    expect(KJ_TO_KCAL_FACTOR).toBe(4.184);
  });

  it("converts kJ to rounded kcal", () => {
    expect(kjToKcal(836.8)).toBe(200);
    expect(kjToKcal(418.4)).toBe(100);
    expect(kjToKcal(837)).toBe(200);
  });

  it("converts kcal to rounded kJ for display", () => {
    expect(kcalToKj(200)).toBe(837);
    expect(kcalToKj(100)).toBe(418);
  });
});
