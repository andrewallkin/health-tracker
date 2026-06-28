import { describe, expect, it } from "vitest";
import {
  parseLocaleNumber,
  parseNonNegative,
  parsePositive,
  sanitizeNumericInput,
} from "./numericInput";

describe("sanitizeNumericInput", () => {
  it("allows comma as decimal separator", () => {
    expect(sanitizeNumericInput("12,5")).toBe("12,5");
  });

  it("allows only one decimal separator", () => {
    expect(sanitizeNumericInput("12,5,3")).toBe("12,53");
    expect(sanitizeNumericInput("12.5.3")).toBe("12.53");
  });

  it("strips non-numeric characters", () => {
    expect(sanitizeNumericInput("abc12,5kg")).toBe("12,5");
  });

  it("can disallow decimals", () => {
    expect(sanitizeNumericInput("12,5", false)).toBe("125");
  });
});

describe("parseLocaleNumber", () => {
  it("parses comma decimals", () => {
    expect(parseLocaleNumber("12,5")).toBe(12.5);
    expect(parseLocaleNumber("12.5")).toBe(12.5);
  });

  it("returns NaN for invalid input", () => {
    expect(parseLocaleNumber("abc")).toBeNaN();
  });
});

describe("parseNonNegative", () => {
  it("rounds comma decimals", () => {
    expect(parseNonNegative("12,4")).toBe(12);
    expect(parseNonNegative("12,6")).toBe(13);
  });
});

describe("parsePositive", () => {
  it("rounds comma decimals", () => {
    expect(parsePositive("2500,4")).toBe(2500);
    expect(parsePositive("2500,6")).toBe(2501);
  });
});
