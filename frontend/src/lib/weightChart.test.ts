import { describe, expect, it } from "vitest";
import { seriesPath, sparseTickIndices } from "./weightChart";

describe("seriesPath", () => {
  it("builds a continuous polyline for consecutive values", () => {
    expect(seriesPath([10, 20], (i) => i * 10, (v) => v)).toBe("M0,10 L10,20");
  });

  it("breaks the path across missing days", () => {
    expect(seriesPath([10, null, 30], (i) => i * 10, (v) => v)).toBe("M0,10 M20,30");
  });

  it("returns empty string when every value is missing", () => {
    expect(seriesPath([null, null], (i) => i, (v) => v)).toBe("");
  });
});

describe("sparseTickIndices", () => {
  it("returns every index when length is within maxTicks", () => {
    expect(sparseTickIndices(4, 6)).toEqual([0, 1, 2, 3]);
  });

  it("always includes first and last index", () => {
    const ticks = sparseTickIndices(30, 6);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(29);
    expect(ticks.length).toBeLessThanOrEqual(6);
  });

  it("returns unique sorted indices", () => {
    expect(sparseTickIndices(10, 6)).toEqual([...new Set(sparseTickIndices(10, 6))].sort((a, b) => a - b));
  });
});
