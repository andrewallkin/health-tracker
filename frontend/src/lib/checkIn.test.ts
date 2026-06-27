import { describe, expect, it } from "vitest";
import { isCheckInValid, parseWeightKg } from "./checkIn";

describe("checkIn validation", () => {
  it("requires at least weight or photos", () => {
    expect(isCheckInValid("", [])).toBe(false);
    expect(isCheckInValid("82", [])).toBe(true);
    expect(isCheckInValid("", ["check-in-photos/u/p.jpg"])).toBe(true);
  });

  it("parses valid weight", () => {
    expect(parseWeightKg("82.5")).toBe(82.5);
    expect(parseWeightKg("")).toBeNull();
    expect(parseWeightKg("10")).toBeNull();
  });
});
