import { describe, it, expect, vi, beforeEach } from "vitest";
import { attachAnalysisGateForEdits } from "./analysis-edit-gate.js";

vi.mock("../services/analysis-options.service.js", () => ({
  runCodebaseAnalysisIfConfigured: vi.fn(),
}));

import { runCodebaseAnalysisIfConfigured } from "../services/analysis-options.service.js";

describe("attachAnalysisGateForEdits", () => {
  beforeEach(() => {
    vi.mocked(runCodebaseAnalysisIfConfigured).mockReset();
  });

  it("flips gateState.analysisReady when analysis resolves true", async () => {
    vi.mocked(runCodebaseAnalysisIfConfigured).mockResolvedValue(true);
    const gateState = { analysisReady: false };
    const p = attachAnalysisGateForEdits("/w", "repo", gateState);
    await p;
    expect(gateState.analysisReady).toBe(true);
  });

  it("clears analysisReady on rejection", async () => {
    vi.mocked(runCodebaseAnalysisIfConfigured).mockRejectedValue(new Error("boom"));
    const gateState = { analysisReady: true };
    const p = attachAnalysisGateForEdits("/w", "repo", gateState);
    await p.catch(() => {});
    expect(gateState.analysisReady).toBe(false);
  });
});
