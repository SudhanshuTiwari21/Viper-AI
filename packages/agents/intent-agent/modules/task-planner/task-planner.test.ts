import { describe, it, expect } from "vitest";
import type { IntentClassification } from "../intent-classifier/intent-classifier.types";
import type { EntityExtractionResult } from "../entity-extractor/entity-extractor.types";
import { planTasks } from "./plan-tasks";

function makeIntent(intentType: IntentClassification["intentType"]): IntentClassification {
  return {
    intentType,
    confidence: 1,
    matchedKeywords: [],
  };
}

const emptyEntities: EntityExtractionResult = { entities: [] };

describe("Task Planner", () => {
  it("creates full CODE_FIX task sequence", () => {
    const intent = makeIntent("CODE_FIX");

    const plan = planTasks(intent, emptyEntities);
    const types = plan.tasks.map((t) => t.type);

    expect(types).toEqual([
      "LOCATE_CODE",
      "ANALYZE_FLOW",
      "IDENTIFY_ISSUE",
      "GENERATE_PATCH",
    ]);
  });

  it("creates CODE_EXPLANATION task sequence", () => {
    const intent = makeIntent("CODE_EXPLANATION");

    const plan = planTasks(intent, emptyEntities);
    const types = plan.tasks.map((t) => t.type);

    expect(types).toEqual(["LOCATE_CODE", "EXPLAIN_CODE"]);
  });

  it("creates CODE_SEARCH task sequence", () => {
    const intent = makeIntent("CODE_SEARCH");

    const plan = planTasks(intent, emptyEntities);
    const types = plan.tasks.map((t) => t.type);

    expect(types).toEqual(["SEARCH_REFERENCES"]);
  });
});

