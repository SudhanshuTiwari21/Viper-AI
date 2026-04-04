import { describe, it, expect } from "vitest";
import { buildReflectionPrompt } from "../reflection/build-reflection-prompt";
import type { ReflectionResult, ExecutionObservation } from "../reflection/reflection.types";

function baseObs(): ExecutionObservation {
  return {
    plan: {
      intent: "CODE_FIX",
      steps: [{ id: "0-GENERATE_PATCH", type: "GENERATE_PATCH", description: "patch" }],
    },
    result: {
      logs: ["[Viper] Running step: GENERATE_PATCH", "[Viper] patch generated"],
      stepOutputs: [],
    },
    capturedErrors: ["LLM timeout"],
    capturedValidation: { valid: false, errors: ["line 42 conflict"] },
    patchGenerated: false,
    patchValid: false,
    filesChanged: [],
    durationMs: 1200,
  };
}

function baseReflection(): ReflectionResult {
  return {
    success: false,
    failures: [
      { kind: "patch_failed", message: "No patch generated" },
      { kind: "runtime_error", message: "LLM timeout" },
    ],
    shouldRetry: true,
    newStrategy: "Analyze code more deeply before patch generation",
    planAdjustments: [
      { action: "add", newStepType: "IDENTIFY_ISSUE", reason: "Need deeper analysis" },
    ],
    summary: "2 issues detected",
  };
}

describe("buildReflectionPrompt", () => {
  it("returns empty string for successful reflection", () => {
    const result = buildReflectionPrompt(
      { ...baseReflection(), success: true, failures: [] },
      baseObs(),
      0,
    );
    expect(result).toBe("");
  });

  it("includes iteration number", () => {
    const result = buildReflectionPrompt(baseReflection(), baseObs(), 2);
    expect(result).toContain("attempt 3");
  });

  it("lists all failures", () => {
    const result = buildReflectionPrompt(baseReflection(), baseObs(), 0);
    expect(result).toContain("[patch_failed]");
    expect(result).toContain("[runtime_error]");
    expect(result).toContain("LLM timeout");
  });

  it("includes validation errors", () => {
    const result = buildReflectionPrompt(baseReflection(), baseObs(), 0);
    expect(result).toContain("VALIDATION ERRORS");
    expect(result).toContain("line 42 conflict");
  });

  it("includes runtime errors", () => {
    const result = buildReflectionPrompt(baseReflection(), baseObs(), 0);
    expect(result).toContain("RUNTIME ERRORS");
    expect(result).toContain("LLM timeout");
  });

  it("includes strategy", () => {
    const result = buildReflectionPrompt(baseReflection(), baseObs(), 0);
    expect(result).toContain("STRATEGY:");
    expect(result).toContain("Analyze code more deeply");
  });

  it("includes plan adjustments", () => {
    const result = buildReflectionPrompt(baseReflection(), baseObs(), 0);
    expect(result).toContain("PLAN ADJUSTMENTS");
    expect(result).toContain("IDENTIFY_ISSUE");
  });

  it("includes tail of execution logs", () => {
    const result = buildReflectionPrompt(baseReflection(), baseObs(), 0);
    expect(result).toContain("EXECUTION LOGS");
    expect(result).toContain("GENERATE_PATCH");
  });

  it("asks what should be done differently", () => {
    const result = buildReflectionPrompt(baseReflection(), baseObs(), 0);
    expect(result).toContain("What should be done differently");
  });
});
