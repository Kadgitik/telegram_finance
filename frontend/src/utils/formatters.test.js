import { describe, expect, it } from "vitest";
import { formatMoney } from "./formatters";

describe("formatMoney", () => {
  it("formats integers", () => {
    expect(formatMoney(1000)).toMatch(/1[\s\u202f\u00a0]?000.*₴/);
  });
});
