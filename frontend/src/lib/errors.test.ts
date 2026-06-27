import { describe, expect, it } from "vitest";

import { getErrorMessage, isValidEmail } from "./errors";

describe("isValidEmail", () => {
  it("accepts common email shapes", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("  user@example.com  ")).toBe(true);
  });

  it("rejects invalid email shapes", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@domain")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error instances", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns string errors directly", () => {
    expect(getErrorMessage("plain error")).toBe("plain error");
  });

  it("falls back when error has no message", () => {
    expect(getErrorMessage(null)).toBe("Something went wrong");
    expect(getErrorMessage({}, "fallback")).toBe("fallback");
  });
});
