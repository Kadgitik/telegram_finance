import { describe, expect, it } from "vitest";
import { categoryProgress, paceBadge, canSpendState } from "./budget";

describe("categoryProgress", () => {
  it("no limit → hasLimit false", () => {
    const p = categoryProgress(500, 0);
    expect(p.hasLimit).toBe(false);
    expect(p.pct).toBe(null);
  });
  it("under limit", () => {
    const p = categoryProgress(2500, 5000);
    expect(p.hasLimit).toBe(true);
    expect(p.pct).toBe(50);
    expect(p.fill).toBe(50);
    expect(p.over).toBe(false);
  });
  it("over limit caps fill at 100 and flags over", () => {
    const p = categoryProgress(6000, 5000);
    expect(p.pct).toBe(120);
    expect(p.fill).toBe(100);
    expect(p.over).toBe(true);
  });
});

describe("paceBadge", () => {
  it("hidden when null", () => {
    expect(paceBadge(null).show).toBe(false);
  });
  it("positive → red, up, +N%", () => {
    const b = paceBadge(28);
    expect(b.show).toBe(true);
    expect(b.up).toBe(true);
    expect(b.text).toBe("+28%");
  });
  it("negative → green, down", () => {
    const b = paceBadge(-12);
    expect(b.up).toBe(false);
    expect(b.text).toBe("-12%");
  });
});

describe("canSpendState", () => {
  it("positive", () => {
    expect(canSpendState(9310)).toEqual({ over: false, value: 9310 });
  });
  it("negative → over with abs value", () => {
    expect(canSpendState(-2000)).toEqual({ over: true, value: 2000 });
  });
});
