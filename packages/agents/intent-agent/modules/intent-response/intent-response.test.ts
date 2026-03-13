import { describe, it, expect } from "vitest";
import type { IntentClassification } from "../intent-classifier/intent-classifier.types";
import type { EntityExtractionResult } from "../entity-extractor/entity-extractor.types";
import type { TaskPlan } from "../task-planner/task-planner.types";
import type { ContextBundle } from "../context-builder-adapter/context-builder.types";
import type { IntentReasoning } from "../intent-reasoner/reasoning.types";
import { generateIntentResponse } from "./generate-response";

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
      { type: "LOCATE_CODE", description: "Locate login API", entities: ["login API"] },
      { type: "ANALYZE_FLOW", description: "Analyze flow" },
    ],
  };
}

function makeContext(): ContextBundle {
  return {
    files: ["auth/login.ts", "auth/service.ts"],
    functions: ["loginUser"],
  };
}

function makeReasoning(): IntentReasoning {
  return {
    detectedComponents: ["loginUser", "auth/login.ts"],
    missingComponents: ["Password hashing"],
    potentialIssues: ["Validation incomplete"],
    recommendedNextStep: "Implementation agent can generate patch",
  };
}

describe("Intent Response Generator", () => {
  it("generates a summary", () => {
    const response = generateIntentResponse(
      makeIntent(),
      makeEntities(),
      makeTasks(),
      makeContext(),
      makeReasoning(),
    );

    expect(response.summary).toBeDefined();
    expect(typeof response.summary).toBe("string");
    expect(response.summary).toContain("CODE_FIX");
    expect(response.summary).toContain("login API");
  });

  it("includes relevant files from ContextBundle", () => {
    const context = makeContext();
    const response = generateIntentResponse(
      makeIntent(),
      makeEntities(),
      makeTasks(),
      context,
      makeReasoning(),
    );

    expect(response.relevantFiles).toEqual(["auth/login.ts", "auth/service.ts"]);
  });

  it("propagates reasoning fields", () => {
    const reasoning = makeReasoning();
    const response = generateIntentResponse(
      makeIntent(),
      makeEntities(),
      makeTasks(),
      makeContext(),
      reasoning,
    );

    expect(response.detectedComponents).toEqual(reasoning.detectedComponents);
    expect(response.missingComponents).toEqual(reasoning.missingComponents);
    expect(response.potentialIssues).toEqual(reasoning.potentialIssues);
    expect(response.recommendedNextStep).toBe(reasoning.recommendedNextStep);
  });
});
