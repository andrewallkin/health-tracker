import { describe, expect, it } from "vitest";
import { seriesPath } from "./weightChart";

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
