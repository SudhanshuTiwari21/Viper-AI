import { describe, it, expect } from "vitest";
import { refinePlan } from "../loop/refine-plan";
import type { ReflectionResult } from "../reflection/reflection.types";
import type { ExecutionPlan } from "@repo/planner-agent";

const basePlan: ExecutionPlan = {
  intent: "CODE_FIX",
  steps: [
    { id: "0-SEARCH_SYMBOL", type: "SEARCH_SYMBOL", description: "search", entities: ["auth.ts"] },
    { id: "1-ANALYZE_CODE", type: "ANALYZE_CODE", description: "analyze", entities: ["auth.ts"] },
    { id: "2-GENERATE_PATCH", type: "GENERATE_PATCH", description: "patch", entities: ["auth.ts"] },
  ],
};

function makeReflection(overrides: Partial<ReflectionResult> = {}): ReflectionResult {
  return {
    success: false,
    failures: [],
    shouldRetry: true,
    newStrategy: "test",
    planAdjustments: [],
    summary: "test",
    ...overrides,
  };
}

describe("refinePlan", () => {
  it("returns unchanged plan with no adjustments", () => {
    const result = refinePlan(basePlan, makeReflection());
    expect(result.steps.map((s) => s.type)).toEqual([
      "SEARCH_SYMBOL",
      "ANALYZE_CODE",
      "GENERATE_PATCH",
    ]);
  });

  it("removes steps", () => {
    const result = refinePlan(
      basePlan,
      makeReflection({
        planAdjustments: [
          { action: "remove", targetStepType: "ANALYZE_CODE", reason: "no tool" },
        ],
      }),
    );
    expect(result.steps.map((s) => s.type)).toEqual([
      "SEARCH_SYMBOL",
      "GENERATE_PATCH",
    ]);
  });

  it("replaces steps", () => {
    const result = refinePlan(
      basePlan,
      makeReflection({
        planAdjustments: [
          {
            action: "replace",
            targetStepType: "SEARCH_SYMBOL",
            newStepType: "SEARCH_EMBEDDING",
            reason: "symbol search failed",
          },
        ],
      }),
    );
    expect(result.steps[0]!.type).toBe("SEARCH_EMBEDDING");
  });

  it("adds steps before GENERATE_PATCH", () => {
    const result = refinePlan(
      basePlan,
      makeReflection({
        planAdjustments: [
          { action: "add", newStepType: "IDENTIFY_ISSUE", reason: "need issue analysis" },
        ],
      }),
    );
    const types = result.steps.map((s) => s.type);
    const issueIdx = types.indexOf("IDENTIFY_ISSUE");
    const patchIdx = types.indexOf("GENERATE_PATCH");
    expect(issueIdx).toBeGreaterThanOrEqual(0);
    expect(issueIdx).toBeLessThan(patchIdx);
  });

  it("does not duplicate existing step types on add", () => {
    const result = refinePlan(
      basePlan,
      makeReflection({
        planAdjustments: [
          { action: "add", newStepType: "ANALYZE_CODE", reason: "already exists" },
        ],
      }),
    );
    const analyzeCount = result.steps.filter((s) => s.type === "ANALYZE_CODE").length;
    expect(analyzeCount).toBe(1);
  });

  it("regenerates step IDs", () => {
    const result = refinePlan(
      basePlan,
      makeReflection({
        planAdjustments: [
          { action: "add", newStepType: "IDENTIFY_ISSUE", reason: "test" },
        ],
      }),
    );
    for (let i = 0; i < result.steps.length; i++) {
      expect(result.steps[i]!.id).toBe(`${i}-${result.steps[i]!.type}`);
    }
  });

  it("preserves entities from original plan", () => {
    const result = refinePlan(
      basePlan,
      makeReflection({
        planAdjustments: [
          { action: "add", newStepType: "IDENTIFY_ISSUE", reason: "test" },
        ],
      }),
    );
    const added = result.steps.find((s) => s.type === "IDENTIFY_ISSUE");
    expect(added?.entities).toEqual(["auth.ts"]);
  });

  it("skips SEARCH_SYMBOL→SEARCH_EMBEDDING replace when embedding step already exists", () => {
    const planWithBoth: ExecutionPlan = {
      intent: "CODE_FIX",
      steps: [
        { id: "0-SEARCH_SYMBOL", type: "SEARCH_SYMBOL", description: "s", entities: ["x"] },
        { id: "1-SEARCH_EMBEDDING", type: "SEARCH_EMBEDDING", description: "e", entities: ["x"] },
        { id: "2-GENERATE_PATCH", type: "GENERATE_PATCH", description: "p", entities: ["x"] },
      ],
    };
    const result = refinePlan(
      planWithBoth,
      makeReflection({
        planAdjustments: [
          {
            action: "replace",
            targetStepType: "SEARCH_SYMBOL",
            newStepType: "SEARCH_EMBEDDING",
            reason: "would duplicate embedding",
          },
        ],
      }),
    );
    expect(result.steps.filter((s) => s.type === "SEARCH_EMBEDDING")).toHaveLength(1);
    expect(result.steps[0]!.type).toBe("SEARCH_SYMBOL");
  });
});
