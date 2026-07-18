import { describe, expect, it } from "vitest";
import {
  MAX_ESTIMATE_PHOTOS,
  canEstimateFood,
  selectedEstimateImageUrl,
} from "./foodEstimate";

describe("estimate photo helpers", () => {
  it("exports max of 5", () => {
    expect(MAX_ESTIMATE_PHOTOS).toBe(5);
  });

  it("canEstimateFood requires note or at least one photo", () => {
    expect(canEstimateFood("", [])).toBe(false);
    expect(canEstimateFood("  ", [])).toBe(false);
    expect(canEstimateFood("salad", [])).toBe(true);
    expect(canEstimateFood("", ["/api/photos/u/a.jpg"])).toBe(true);
    expect(canEstimateFood("  ", ["/api/photos/u/a.jpg"])).toBe(true);
  });

  it("selectedEstimateImageUrl returns selected url or undefined", () => {
    const urls = ["/a.jpg", "/b.jpg"];
    expect(selectedEstimateImageUrl([], 0)).toBeUndefined();
    expect(selectedEstimateImageUrl(urls, 0)).toBe("/a.jpg");
    expect(selectedEstimateImageUrl(urls, 1)).toBe("/b.jpg");
    expect(selectedEstimateImageUrl(urls, 99)).toBeUndefined();
    expect(selectedEstimateImageUrl(urls, -1)).toBeUndefined();
  });
});
