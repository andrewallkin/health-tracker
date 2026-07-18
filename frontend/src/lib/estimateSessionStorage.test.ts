import { afterEach, describe, expect, it } from "vitest";

import {
  loadEstimateSession,
  saveEstimateSession,
  type EstimateSession,
} from "./estimateSessionStorage";

const sample: EstimateSession = {
  input: { note: "oats", photoUrls: [] },
  estimate: {
    name: "Oats",
    calories_kcal: 300,
    macros_g: { protein: 10, carbs: 50, fat: 5 },
    confidence: "medium",
    source: "estimate",
    summary: "bowl of oats",
    assumptions: [],
  },
};

afterEach(() => {
  sessionStorage.clear();
});

describe("estimateSessionStorage", () => {
  it("round-trips a session", () => {
    saveEstimateSession(sample);
    expect(loadEstimateSession()).toEqual(sample);
  });

  it("clears when saved null", () => {
    saveEstimateSession(sample);
    saveEstimateSession(null);
    expect(loadEstimateSession()).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    sessionStorage.setItem("health-tracker:estimate-session", "{not-json");
    expect(loadEstimateSession()).toBeNull();
  });
});
