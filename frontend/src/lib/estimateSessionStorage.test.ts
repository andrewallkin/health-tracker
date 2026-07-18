import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  loadEstimateSession,
  saveEstimateSession,
  type EstimateSession,
} from "./estimateSessionStorage";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

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

beforeAll(() => {
  Object.defineProperty(globalThis, "sessionStorage", {
    value: createMemoryStorage(),
    configurable: true,
  });
});

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
