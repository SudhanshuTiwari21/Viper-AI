import { describe, expect, it } from "vitest";
import { isPremiumTierEntitled } from "./is-premium-tier-entitled.js";

describe("isPremiumTierEntitled", () => {
  it("allows premium when list is null or empty", () => {
    expect(isPremiumTierEntitled(null)).toBe(true);
    expect(isPremiumTierEntitled(undefined)).toBe(true);
    expect(isPremiumTierEntitled([])).toBe(true);
  });

  it("allows premium when tier list includes premium", () => {
    expect(isPremiumTierEntitled(["auto", "premium"])).toBe(true);
    expect(isPremiumTierEntitled(["premium"])).toBe(true);
  });

  it("denies premium when only auto or fast", () => {
    expect(isPremiumTierEntitled(["auto"])).toBe(false);
    expect(isPremiumTierEntitled(["auto", "fast"])).toBe(false);
  });
});
