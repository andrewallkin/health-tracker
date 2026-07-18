import { describe, expect, it } from "vitest";

import { bandFromSleepScore } from "./healthColors";

describe("bandFromSleepScore", () => {
  it("uses proposal A thresholds", () => {
    expect(bandFromSleepScore(59)).toBe("poor");
    expect(bandFromSleepScore(60)).toBe("fair");
    expect(bandFromSleepScore(69)).toBe("fair");
    expect(bandFromSleepScore(70)).toBe("good");
    expect(bandFromSleepScore(79)).toBe("good");
    expect(bandFromSleepScore(80)).toBe("great");
    expect(bandFromSleepScore(100)).toBe("great");
  });
});
