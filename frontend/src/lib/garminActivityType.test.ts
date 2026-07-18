import { describe, expect, it } from "vitest";

import { mapGarminActivityType } from "./garminActivityType";

describe("mapGarminActivityType", () => {
  it("maps known Garmin typeKeys to app ActivityType", () => {
    expect(mapGarminActivityType("strength_training")).toBe("strength_training");
    expect(mapGarminActivityType("running")).toBe("running");
    expect(mapGarminActivityType("trail_running")).toBe("running");
    expect(mapGarminActivityType("cycling")).toBe("cycling");
    expect(mapGarminActivityType("road_biking")).toBe("cycling");
    expect(mapGarminActivityType("walking")).toBe("walking");
    expect(mapGarminActivityType("hiking")).toBe("hiking");
    expect(mapGarminActivityType("indoor_cardio")).toBe("cardio");
    expect(mapGarminActivityType("cardio")).toBe("cardio");
  });

  it("falls back to other for unknown keys", () => {
    expect(mapGarminActivityType("yoga")).toBe("other");
    expect(mapGarminActivityType("")).toBe("other");
    expect(mapGarminActivityType(null)).toBe("other");
    expect(mapGarminActivityType(undefined)).toBe("other");
  });
});
