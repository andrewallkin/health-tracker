import { describe, expect, it } from "vitest";

import { formatHoursAsHm, formatMinutesAsHm } from "./formatDuration";

describe("formatHoursAsHm", () => {
  it("formats decimal hours as hours and minutes", () => {
    expect(formatHoursAsHm(7.7)).toBe("7h 42m");
    expect(formatHoursAsHm(7.0)).toBe("7h");
    expect(formatHoursAsHm(0.5)).toBe("30m");
  });
});

describe("formatMinutesAsHm", () => {
  it("keeps minutes under an hour as minutes only", () => {
    expect(formatMinutesAsHm(30)).toBe("30m");
    expect(formatMinutesAsHm(58)).toBe("58m");
    expect(formatMinutesAsHm(60)).toBe("60m");
  });

  it("formats over 60 minutes as hours and minutes", () => {
    expect(formatMinutesAsHm(61)).toBe("1h 1m");
    expect(formatMinutesAsHm(67)).toBe("1h 7m");
    expect(formatMinutesAsHm(120)).toBe("2h");
  });
});
