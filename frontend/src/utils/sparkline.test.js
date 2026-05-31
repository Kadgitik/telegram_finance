import { describe, expect, it } from "vitest";
import { sparklinePath } from "./sparkline";

describe("sparklinePath", () => {
  it("returns empty string for no data", () => {
    expect(sparklinePath([])).toBe("");
    expect(sparklinePath(undefined)).toBe("");
  });

  it("draws a flat line for a single point", () => {
    const d = sparklinePath([5], 100, 28);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("L");
  });

  it("builds a path with M then L commands for multiple points", () => {
    const d = sparklinePath([1, 5, 2, 8], 100, 28);
    expect(d.startsWith("M")).toBe(true);
    expect((d.match(/L/g) || []).length).toBe(3);
    expect(d).not.toMatch(/NaN/);
  });

  it("handles all-equal values without NaN (flat span)", () => {
    const d = sparklinePath([4, 4, 4], 100, 28);
    expect(d).not.toMatch(/NaN/);
  });
});
