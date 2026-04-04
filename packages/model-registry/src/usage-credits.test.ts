import { describe, it, expect } from "vitest";
import { computeUsageCostUnits, resolveUsageCreditWeightPer1k } from "./usage-credits.js";

describe("resolveUsageCreditWeightPer1k", () => {
  it("returns registry weight for gpt-4o-mini", () => {
    expect(resolveUsageCreditWeightPer1k("gpt-4o-mini")).toBe(1);
  });

  it("returns registry weight for gpt-4o", () => {
    expect(resolveUsageCreditWeightPer1k("gpt-4o")).toBe(14);
  });
});

describe("computeUsageCostUnits", () => {
  it("uses total_tokens with model weight (gpt-4o-mini)", () => {
    expect(
      computeUsageCostUnits({
        modelId: "gpt-4o-mini",
        totalTokens: 2000,
        assumedTotalTokensWhenUnknown: 999,
      }),
    ).toBe(2n);
  });

  it("sums input + output when total missing", () => {
    expect(
      computeUsageCostUnits({
        modelId: "gpt-4o-mini",
        inputTokens: 500,
        outputTokens: 500,
        assumedTotalTokensWhenUnknown: 999,
      }),
    ).toBe(1n);
  });

  it("floors at 1 unit", () => {
    expect(
      computeUsageCostUnits({
        modelId: "gpt-4o-mini",
        totalTokens: 1,
        assumedTotalTokensWhenUnknown: 999,
      }),
    ).toBe(1n);
  });

  it("uses assumed total when no token signal", () => {
    expect(
      computeUsageCostUnits({
        modelId: "gpt-4o-mini",
        assumedTotalTokensWhenUnknown: 3000,
      }),
    ).toBe(3n);
  });

  it("uses conservative default weight for unknown model id", () => {
    const w = resolveUsageCreditWeightPer1k("not-in-registry-xyz");
    expect(w).toBe(2);
    expect(
      computeUsageCostUnits({
        modelId: "not-in-registry-xyz",
        totalTokens: 1000,
        assumedTotalTokensWhenUnknown: 999,
      }),
    ).toBe(2n);
  });
});
