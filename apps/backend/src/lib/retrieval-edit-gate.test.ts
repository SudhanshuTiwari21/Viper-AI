import { describe, it, expect } from "vitest";
import { shouldBlockEditForRetrievalConfidence } from "./retrieval-edit-gate.js";

describe("shouldBlockEditForRetrievalConfidence", () => {
  it("never blocks when threshold is 0 (feature off)", () => {
    expect(shouldBlockEditForRetrievalConfidence(0, 0)).toBe(false);
    expect(shouldBlockEditForRetrievalConfidence(0.1, 0)).toBe(false);
  });

  it("blocks when threshold > 0 and overall is below threshold", () => {
    expect(shouldBlockEditForRetrievalConfidence(0.54, 0.55)).toBe(true);
    expect(shouldBlockEditForRetrievalConfidence(0, 0.55)).toBe(true);
  });

  it("allows edit when overall meets or exceeds threshold", () => {
    expect(shouldBlockEditForRetrievalConfidence(0.55, 0.55)).toBe(false);
    expect(shouldBlockEditForRetrievalConfidence(0.9, 0.55)).toBe(false);
  });
});
