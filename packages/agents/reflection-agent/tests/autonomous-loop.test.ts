import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExecutionPlan } from "@repo/planner-agent";
import type { ContextBuilderAdapter } from "@repo/context-builder";

const basePlan: ExecutionPlan = {
  intent: "CODE_FIX",
  steps: [
    { id: "0-SEARCH_SYMBOL", type: "SEARCH_SYMBOL", description: "search", entities: ["auth.ts"] },
    { id: "1-GENERATE_PATCH", type: "GENERATE_PATCH", description: "patch", entities: ["auth.ts"] },
  ],
};

const fakeAdapter = {} as ContextBuilderAdapter;

const mockExecutePlan = vi.fn();

vi.mock("@repo/execution-engine", () => ({
  executePlan: (...args: unknown[]) => mockExecutePlan(...args),
}));

import { runAutonomousLoop } from "../loop/autonomous-loop";

function stepOutputsFromPlan(plan: ExecutionPlan, withResult = true) {
  return plan.steps.map((s, i) => ({
    stepId: s.id,
    stepType: s.type,
    ...(i === 0 && withResult
      ? { result: { files: ["auth.ts"], functions: [], snippets: [], estimatedTokens: 100 } }
      : {}),
  }));
}

describe("runAutonomousLoop", () => {
  beforeEach(() => {
    mockExecutePlan.mockReset();
  });

  it("succeeds on first pass when no failures detected", async () => {
    mockExecutePlan.mockImplementation(async (plan: ExecutionPlan, opts: { onEvent?: (e: unknown) => void }) => {
      opts.onEvent?.({
        type: "patch:preview",
        data: {
          patch: { changes: [{}], operations: [] },
          diffs: [{ file: "auth.ts", before: "", after: "" }],
          workspacePath: "/test",
          previewId: "p1",
          patchHash: "abc",
        },
      });
      return { logs: ["ok"], stepOutputs: stepOutputsFromPlan(plan) };
    });

    const result = await runAutonomousLoop(basePlan, {
      repo_id: "test",
      query: "fix auth",
      adapter: fakeAdapter,
    });

    expect(result.success).toBe(true);
    expect(result.totalIterations).toBe(1);
    expect(result.haltReason).toBe("success");
  });

  it("retries and succeeds on second pass", async () => {
    let callCount = 0;
    mockExecutePlan.mockImplementation(async (plan: ExecutionPlan, opts: { onEvent?: (e: unknown) => void }) => {
      callCount++;
      if (callCount === 1) {
        opts.onEvent?.({ type: "error", data: { message: "LLM timeout" } });
        return { logs: ["attempt 1 failed"], stepOutputs: stepOutputsFromPlan(plan) };
      }
      opts.onEvent?.({
        type: "patch:preview",
        data: {
          patch: { changes: [{}], operations: [] },
          diffs: [{ file: "auth.ts", before: "", after: "" }],
          workspacePath: "/test",
          previewId: "p1",
          patchHash: "abc",
        },
      });
      return { logs: ["attempt 2 succeeded"], stepOutputs: stepOutputsFromPlan(plan) };
    });

    const onReflection = vi.fn();
    const result = await runAutonomousLoop(basePlan, {
      repo_id: "test",
      query: "fix auth",
      adapter: fakeAdapter,
      onReflection,
    });

    expect(result.totalIterations).toBe(2);
    expect(result.success).toBe(true);
    expect(result.haltReason).toBe("success");
    expect(onReflection).toHaveBeenCalledOnce();
  });

  it("stops after max iterations", async () => {
    mockExecutePlan.mockImplementation(async (plan: ExecutionPlan, opts: { onEvent?: (e: unknown) => void }) => {
      opts.onEvent?.({ type: "error", data: { message: `fail-${Date.now()}-${Math.random()}` } });
      return { logs: ["fail"], stepOutputs: stepOutputsFromPlan(plan) };
    });

    const result = await runAutonomousLoop(basePlan, {
      repo_id: "test",
      query: "fix auth",
      adapter: fakeAdapter,
      maxIterations: 3,
    });

    expect(result.success).toBe(false);
    expect(result.totalIterations).toBe(3);
    expect(result.haltReason).toBe("max_iterations");
  });

  it("halts on repeated identical failures", async () => {
    mockExecutePlan.mockImplementation(async (plan: ExecutionPlan, opts: { onEvent?: (e: unknown) => void }) => {
      opts.onEvent?.({ type: "error", data: { message: "same error" } });
      return { logs: ["fail"], stepOutputs: stepOutputsFromPlan(plan) };
    });

    const result = await runAutonomousLoop(basePlan, {
      repo_id: "test",
      query: "fix auth",
      adapter: fakeAdapter,
      maxIterations: 5,
    });

    expect(result.success).toBe(false);
    expect(result.haltReason).toBe("repeated_failure");
    expect(result.totalIterations).toBe(2);
  });

  it("records iterations with full debug history", async () => {
    let callCount = 0;
    mockExecutePlan.mockImplementation(async (plan: ExecutionPlan, opts: { onEvent?: (e: unknown) => void }) => {
      callCount++;
      if (callCount < 2) {
        opts.onEvent?.({ type: "error", data: { message: "transient" } });
        return { logs: ["fail"], stepOutputs: stepOutputsFromPlan(plan) };
      }
      opts.onEvent?.({
        type: "patch:preview",
        data: {
          patch: { changes: [{}], operations: [] },
          diffs: [{ file: "auth.ts", before: "", after: "" }],
          workspacePath: "/test",
          previewId: "p1",
          patchHash: "abc",
        },
      });
      return { logs: ["ok"], stepOutputs: stepOutputsFromPlan(plan) };
    });

    const result = await runAutonomousLoop(basePlan, {
      repo_id: "test",
      query: "fix auth",
      adapter: fakeAdapter,
    });

    expect(result.iterations.length).toBeGreaterThanOrEqual(1);
    for (const iter of result.iterations) {
      expect(iter.plan).toBeDefined();
      expect(iter.result).toBeDefined();
      expect(iter.observation).toBeDefined();
      expect(iter.reflection).toBeDefined();
      expect(typeof iter.durationMs).toBe("number");
    }
  });

  it("respects maxIterations=1 (no retry)", async () => {
    mockExecutePlan.mockImplementation(async (plan: ExecutionPlan, opts: { onEvent?: (e: unknown) => void }) => {
      opts.onEvent?.({ type: "error", data: { message: "fail" } });
      return { logs: ["fail"], stepOutputs: stepOutputsFromPlan(plan) };
    });

    const result = await runAutonomousLoop(basePlan, {
      repo_id: "test",
      query: "fix auth",
      adapter: fakeAdapter,
      maxIterations: 1,
    });

    expect(result.success).toBe(false);
    expect(result.totalIterations).toBe(1);
  });

  it("emits plan events for re-planned iterations", async () => {
    let callCount = 0;
    const events: Array<{ type: string }> = [];
    mockExecutePlan.mockImplementation(async (plan: ExecutionPlan, opts: { onEvent?: (e: unknown) => void }) => {
      callCount++;
      if (callCount === 1) {
        opts.onEvent?.({ type: "error", data: { message: "fail" } });
        return { logs: ["fail"], stepOutputs: stepOutputsFromPlan(plan) };
      }
      opts.onEvent?.({
        type: "patch:preview",
        data: {
          patch: { changes: [{}], operations: [] },
          diffs: [{ file: "auth.ts", before: "", after: "" }],
          workspacePath: "/test",
          previewId: "p1",
          patchHash: "abc",
        },
      });
      return { logs: ["ok"], stepOutputs: stepOutputsFromPlan(plan) };
    });

    await runAutonomousLoop(basePlan, {
      repo_id: "test",
      query: "fix auth",
      adapter: fakeAdapter,
      onEvent: (e) => events.push(e as { type: string }),
    });

    const planEvents = events.filter((e) => e.type === "plan");
    expect(planEvents.length).toBeGreaterThanOrEqual(1);
  });
});
