import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IntentClassification } from "../intent-classifier/intent-classifier.types";
import type { EntityExtractionResult } from "../entity-extractor/entity-extractor.types";
import type { TaskPlan } from "../task-planner/task-planner.types";
import type { ContextBundle } from "../context-builder-adapter/context-builder.types";
import { runReasoning } from "./run-reasoning";

vi.mock("./llm-client.service", () => ({
  runReasoningPrompt: vi.fn(),
}));

import { runReasoningPrompt } from "./llm-client.service";

const mockedRunReasoningPrompt = vi.mocked(runReasoningPrompt);

function makeIntent(): IntentClassification {
  return {
    intentType: "CODE_FIX",
    confidence: 0.9,
    matchedKeywords: ["fix"],
  };
}

function makeEntities(): EntityExtractionResult {
  return {
    entities: [{ type: "api", value: "login API" }],
  };
}

function makeTasks(): TaskPlan {
  return {
    intent: "CODE_FIX",
    tasks: [
      { type: "LOCATE_CODE", description: "Locate implementation of login API", entities: ["login API"] },
      { type: "ANALYZE_FLOW", description: "Analyze authentication flow" },
      { type: "IDENTIFY_ISSUE", description: "Identify cause of bug" },
      { type: "GENERATE_PATCH", description: "Prepare code modification" },
    ],
  };
}

function makeContext(): ContextBundle {
  return {
    files: ["auth/login.ts"],
    functions: ["loginUser"],
    dependencies: [{ from: "auth/login.ts", to: "auth/service.ts" }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Intent Reasoner", () => {
  it("returns detectedComponents from parsed LLM response", async () => {
    mockedRunReasoningPrompt.mockResolvedValue(
      JSON.stringify({
        detectedComponents: ["loginUser", "auth/login.ts"],
        missingComponents: [],
        potentialIssues: [],
        recommendedNextStep: "Apply patch",
      }),
    );

    const result = await runReasoning(
      "fix the login API bug",
      makeIntent(),
      makeEntities(),
      makeTasks(),
      makeContext(),
    );

    expect(result.detectedComponents).toEqual(["loginUser", "auth/login.ts"]);
    expect(mockedRunReasoningPrompt).toHaveBeenCalledTimes(1);
    const builtPrompt = mockedRunReasoningPrompt.mock.calls[0][0];
    expect(builtPrompt).toContain('"fix the login API bug"');
    expect(builtPrompt).toContain("USER REQUEST:");
    expect(builtPrompt).toContain("Intent Type: CODE_FIX");
  });
});
