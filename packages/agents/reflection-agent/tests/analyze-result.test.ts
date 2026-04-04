import { describe, it, expect } from "vitest";
import { analyzeResult } from "../reflection/analyze-result";
import type { ExecutionObservation } from "../reflection/reflection.types";

function baseObs(overrides: Partial<ExecutionObservation> = {}): ExecutionObservation {
  return {
    plan: {
      intent: "CODE_FIX",
      steps: [
        { id: "0-SEARCH_SYMBOL", type: "SEARCH_SYMBOL", description: "search", entities: ["auth.ts"] },
        { id: "1-GENERATE_PATCH", type: "GENERATE_PATCH", description: "patch", entities: ["auth.ts"] },
      ],
    },
    result: {
      logs: [],
      stepOutputs: [
        { stepId: "0-SEARCH_SYMBOL", stepType: "SEARCH_SYMBOL", result: { files: ["auth.ts"], functions: [], snippets: [], estimatedTokens: 50 } },
        { stepId: "1-GENERATE_PATCH", stepType: "GENERATE_PATCH" },
      ],
    },
    capturedErrors: [],
    patchGenerated: true,
    patchValid: true,
    filesChanged: ["auth.ts"],
    durationMs: 500,
    ...overrides,
  };
}

describe("analyzeResult", () => {
  it("returns success=true for healthy execution", () => {
    const result = analyzeResult(baseObs());
    expect(result.success).toBe(true);
    expect(result.shouldRetry).toBe(false);
    expect(result.failures).toHaveLength(0);
  });

  it("returns shouldRetry=true for retriable failures", () => {
    const obs = baseObs({
      patchGenerated: false,
    });
    const result = analyzeResult(obs);
    expect(result.success).toBe(false);
    expect(result.shouldRetry).toBe(true);
    expect(result.newStrategy).toBeTruthy();
  });

  it("suggests adding IDENTIFY_ISSUE when patch fails", () => {
    const obs = baseObs({
      patchGenerated: false,
    });
    const result = analyzeResult(obs);
    const addIssue = result.planAdjustments.find(
      (a) => a.action === "add" && a.newStepType === "IDENTIFY_ISSUE",
    );
    expect(addIssue).toBeDefined();
  });

  it("suggests SEARCH_EMBEDDING when no context found", () => {
    const obs = baseObs({
      result: {
        logs: [],
        contextWindow: { files: [], functions: [], snippets: [], estimatedTokens: 0 },
        stepOutputs: [
          { stepId: "0-SEARCH_SYMBOL", stepType: "SEARCH_SYMBOL", result: { files: [], functions: [], snippets: [], estimatedTokens: 0 } },
        ],
      },
    });
    const result = analyzeResult(obs);
    const addEmbed = result.planAdjustments.find(
      (a) => a.newStepType === "SEARCH_EMBEDDING",
    );
    expect(addEmbed).toBeDefined();
  });

  it("suggests replacing SEARCH_SYMBOL for wrong files", () => {
    const obs = baseObs({
      filesChanged: ["unrelated.ts"],
    });
    const result = analyzeResult(obs);
    const replace = result.planAdjustments.find(
      (a) => a.action === "replace" && a.targetStepType === "SEARCH_SYMBOL",
    );
    expect(replace).toBeDefined();
  });

  it("does not replace SEARCH_SYMBOL when SEARCH_EMBEDDING already in plan", () => {
    const obs = baseObs({
      plan: {
        intent: "CODE_FIX",
        steps: [
          { id: "0-SEARCH_SYMBOL", type: "SEARCH_SYMBOL", description: "s", entities: ["auth.ts"] },
          { id: "1-SEARCH_EMBEDDING", type: "SEARCH_EMBEDDING", description: "e", entities: ["auth.ts"] },
          { id: "2-GENERATE_PATCH", type: "GENERATE_PATCH", description: "p", entities: ["auth.ts"] },
        ],
      },
      filesChanged: ["unrelated.ts"],
    });
    const result = analyzeResult(obs);
    const replace = result.planAdjustments.find(
      (a) => a.action === "replace" && a.newStepType === "SEARCH_EMBEDDING",
    );
    expect(replace).toBeUndefined();
  });

  it("suggests removing skipped steps", () => {
    const obs = baseObs({
      plan: {
        intent: "CODE_FIX",
        steps: [
          { id: "0-ANALYZE_CODE", type: "ANALYZE_CODE", description: "analyze" },
          { id: "1-GENERATE_PATCH", type: "GENERATE_PATCH", description: "patch" },
        ],
      },
      result: {
        logs: [],
        stepOutputs: [
          { stepId: "1-GENERATE_PATCH", stepType: "GENERATE_PATCH" },
        ],
      },
    });
    const result = analyzeResult(obs);
    const remove = result.planAdjustments.find(
      (a) => a.action === "remove" && a.targetStepType === "ANALYZE_CODE",
    );
    expect(remove).toBeDefined();
  });

  it("builds a human-readable summary", () => {
    const obs = baseObs({ capturedErrors: ["timeout"] });
    const result = analyzeResult(obs);
    expect(result.summary).toContain("runtime_error");
    expect(result.summary).toContain("timeout");
  });
});
