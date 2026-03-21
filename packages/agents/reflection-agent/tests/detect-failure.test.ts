import { describe, it, expect } from "vitest";
import { detectFailures } from "../reflection/detect-failure";
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

describe("detectFailures", () => {
  it("returns empty array for successful execution", () => {
    const failures = detectFailures(baseObs());
    expect(failures).toHaveLength(0);
  });

  it("detects runtime errors", () => {
    const obs = baseObs({ capturedErrors: ["connection refused", "timeout"] });
    const failures = detectFailures(obs);
    expect(failures).toHaveLength(2);
    expect(failures.every((f) => f.kind === "runtime_error")).toBe(true);
  });

  it("detects skipped steps", () => {
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
    const failures = detectFailures(obs);
    const skipped = failures.filter((f) => f.kind === "step_skipped");
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.stepId).toBe("0-ANALYZE_CODE");
  });

  it("detects empty result", () => {
    const obs = baseObs({
      result: {
        logs: [],
        stepOutputs: [
          { stepId: "0-SEARCH_SYMBOL", stepType: "SEARCH_SYMBOL" },
        ],
      },
    });
    const failures = detectFailures(obs);
    expect(failures.some((f) => f.kind === "empty_result")).toBe(true);
  });

  it("detects no context found", () => {
    const obs = baseObs({
      result: {
        logs: [],
        contextWindow: { files: [], functions: [], snippets: [], estimatedTokens: 0 },
        stepOutputs: [
          { stepId: "0-SEARCH_SYMBOL", stepType: "SEARCH_SYMBOL", result: { files: [], functions: [], snippets: [], estimatedTokens: 0 } },
        ],
      },
    });
    const failures = detectFailures(obs);
    expect(failures.some((f) => f.kind === "no_context_found")).toBe(true);
  });

  it("detects patch failed — not generated", () => {
    const obs = baseObs({ patchGenerated: false });
    const failures = detectFailures(obs);
    expect(failures.some((f) => f.kind === "patch_failed")).toBe(true);
  });

  it("detects patch failed — not valid", () => {
    const obs = baseObs({ patchValid: false });
    const failures = detectFailures(obs);
    expect(failures.some((f) => f.kind === "patch_failed")).toBe(true);
  });

  it("detects patch conflicts", () => {
    const obs = baseObs({
      capturedValidation: { valid: false, errors: ["line 42 changed since preview"] },
    });
    const failures = detectFailures(obs);
    expect(failures.some((f) => f.kind === "patch_conflicts")).toBe(true);
  });

  it("detects wrong files edited", () => {
    const obs = baseObs({
      filesChanged: ["totally-unrelated.ts"],
    });
    const failures = detectFailures(obs);
    expect(failures.some((f) => f.kind === "wrong_files_edited")).toBe(true);
  });

  it("does not flag wrong files when entity is a substring match", () => {
    const obs = baseObs({
      plan: {
        intent: "CODE_FIX",
        steps: [
          { id: "0-SEARCH_SYMBOL", type: "SEARCH_SYMBOL", description: "search", entities: ["auth"] },
          { id: "1-GENERATE_PATCH", type: "GENERATE_PATCH", description: "patch", entities: ["auth"] },
        ],
      },
      filesChanged: ["auth/login.ts"],
    });
    const failures = detectFailures(obs);
    expect(failures.some((f) => f.kind === "wrong_files_edited")).toBe(false);
  });
});
