import { describe, it, expect, vi, beforeEach } from "vitest";
import { executePlan } from "./execute-plan";
import { runStep } from "./step-runner";
import { createExecutionContext } from "./execution-context";
import type { ExecutionPlan, PlanStep } from "@repo/planner-agent";
import type { ContextBuilderAdapter } from "@repo/context-builder";

const mockAdapter: ContextBuilderAdapter = {
  searchSymbols: vi.fn().mockResolvedValue([
    { filePath: "src/auth/login.ts", symbolName: "loginUser", kind: "function" as const },
  ]),
  searchEmbeddings: vi.fn().mockResolvedValue([
    { text: "function loginUser() {}", score: 0.9, file: "src/auth/login.ts", symbol: "loginUser" },
  ]),
  getDependencies: vi.fn().mockResolvedValue([
    { from: "loginUser", to: "validateToken", type: "call" },
  ]),
};

beforeEach(() => {
  vi.clearAllMocks();
});

function makeCodeFixPlan(): ExecutionPlan {
  return {
    intent: "CODE_FIX",
    steps: [
      { id: "0-SEARCH_SYMBOL", type: "SEARCH_SYMBOL", description: "Locate symbols", entities: ["login API"] },
      { id: "1-SEARCH_EMBEDDING", type: "SEARCH_EMBEDDING", description: "Semantic search", entities: ["login API"] },
      { id: "2-FETCH_DEPENDENCIES", type: "FETCH_DEPENDENCIES", description: "Dep graph", entities: ["login API"] },
      { id: "3-ANALYZE_CODE", type: "ANALYZE_CODE", description: "Analyze", entities: ["login API"] },
      { id: "4-IDENTIFY_ISSUE", type: "IDENTIFY_ISSUE", description: "Identify", entities: ["login API"] },
      { id: "5-GENERATE_PATCH", type: "GENERATE_PATCH", description: "Patch", entities: ["login API"] },
    ],
  };
}

function makeGenericPlan(): ExecutionPlan {
  return {
    intent: "GENERIC",
    steps: [
      { id: "0-NO_OP", type: "NO_OP", description: "No operation required" },
    ],
  };
}

describe("executePlan", () => {
  it("executes all steps of a CODE_FIX plan and returns contextWindow", async () => {
    const plan = makeCodeFixPlan();
    const result = await executePlan(plan, {
      repo_id: "test-repo",
      query: "fix login api",
      adapter: mockAdapter,
    });

    expect(result.logs).toContain("[Viper] Running step: SEARCH_SYMBOL");
    expect(result.logs).toContain("[Viper] Running step: SEARCH_EMBEDDING");
    expect(result.logs).toContain("[Viper] Running step: FETCH_DEPENDENCIES");
    expect(result.logs).toContain("[Viper] Running step: ANALYZE_CODE");
    expect(result.logs).toContain("[Viper] Running step: IDENTIFY_ISSUE");
    expect(result.logs).toContain("[Viper] Running step: GENERATE_PATCH");
    expect(result.logs).toHaveLength(9);

    expect(result.stepOutputs.length).toBeGreaterThanOrEqual(3);
    expect(result.contextWindow).toBeDefined();
    expect(result.contextWindow?.files).toBeDefined();
    expect(result.contextWindow?.functions).toBeDefined();
  });

  it("handles GENERIC/NO_OP plan with no tool calls", async () => {
    const plan = makeGenericPlan();
    const result = await executePlan(plan, {
      repo_id: "test-repo",
      query: "hi",
      adapter: mockAdapter,
    });

    expect(result.logs).toContain("[Viper] Running step: NO_OP");
    expect(result.logs).toContain("[Viper] No tool for step: NO_OP — skipped");
    expect(result.stepOutputs).toHaveLength(0);
    expect(result.contextWindow).toBeUndefined();
    expect(mockAdapter.searchSymbols).not.toHaveBeenCalled();
    expect(mockAdapter.searchEmbeddings).not.toHaveBeenCalled();
    expect(mockAdapter.getDependencies).not.toHaveBeenCalled();
  });

  it("captures ordered logs for each executed step", async () => {
    const plan = makeCodeFixPlan();
    const result = await executePlan(plan, {
      repo_id: "test-repo",
      query: "fix login api",
      adapter: mockAdapter,
    });

    const runLogs = result.logs.filter((l) => l.startsWith("[Viper] Running step:"));
    expect(runLogs[0]).toBe("[Viper] Running step: SEARCH_SYMBOL");
    expect(runLogs[1]).toBe("[Viper] Running step: SEARCH_EMBEDDING");
    expect(runLogs[2]).toBe("[Viper] Running step: FETCH_DEPENDENCIES");
    expect(runLogs[3]).toBe("[Viper] Running step: ANALYZE_CODE");
    expect(runLogs[4]).toBe("[Viper] Running step: IDENTIFY_ISSUE");
    expect(runLogs[5]).toBe("[Viper] Running step: GENERATE_PATCH");
  });
});

describe("runStep", () => {
  it("returns stepOutput with result for a tool-backed step", async () => {
    const step: PlanStep = {
      id: "0-SEARCH_SYMBOL",
      type: "SEARCH_SYMBOL",
      description: "Locate symbols",
      entities: ["auth"],
    };
    const ctx = createExecutionContext({
      repo_id: "test-repo",
      query: "fix auth",
      adapter: mockAdapter,
    });

    const output = await runStep(step, ctx);
    expect(output.stepId).toBe("0-SEARCH_SYMBOL");
    expect(output.stepType).toBe("SEARCH_SYMBOL");
    expect(output.result).toBeDefined();
  });

  it("returns stepOutput without result for NO_OP", async () => {
    const step: PlanStep = {
      id: "0-NO_OP",
      type: "NO_OP",
      description: "No operation required",
    };
    const ctx = createExecutionContext({
      repo_id: "test-repo",
      query: "hi",
      adapter: mockAdapter,
    });

    const output = await runStep(step, ctx);
    expect(output.stepId).toBe("0-NO_OP");
    expect(output.result).toBeUndefined();
    expect(ctx.intermediateResults).toHaveLength(0);
  });
});
