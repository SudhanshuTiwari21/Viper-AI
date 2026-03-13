import { describe, it, expect } from "vitest";
import type { TaskPlan, PlannedTask } from "../task-planner/task-planner.types";
import type { EntityExtractionResult } from "../entity-extractor/entity-extractor.types";
import { buildContextRequest } from "./build-context-request";

function makePlan(tasks: PlannedTask[]): TaskPlan {
  return { intent: "CODE_FIX", tasks };
}

describe("Context Request Builder", () => {
  it("adds symbolSearch and embeddingSearch for LOCATE_CODE with entity login API", () => {
    const plan = makePlan([
      {
        type: "LOCATE_CODE",
        description: "Locate implementation of login API",
        entities: ["login API"],
      },
    ]);
    const entities: EntityExtractionResult = {
      entities: [{ type: "api", value: "login API" }],
    };

    const request = buildContextRequest(plan, entities);

    expect(request.symbolSearch).toEqual(["login"]);
    expect(request.embeddingSearch).toEqual(["login API"]);
  });

  it("sets dependencyLookup for ANALYZE_FLOW task", () => {
    const plan = makePlan([
      {
        type: "ANALYZE_FLOW",
        description: "Analyze authentication flow",
      },
    ]);
    const entities: EntityExtractionResult = { entities: [] };

    const request = buildContextRequest(plan, entities);

    expect(request.dependencyLookup).toBe(true);
  });

  it("adds symbolSearch for SEARCH_REFERENCES task", () => {
    const plan = makePlan([
      {
        type: "SEARCH_REFERENCES",
        description: "Search references for jwt",
        entities: ["jwt"],
      },
    ]);
    const entities: EntityExtractionResult = {
      entities: [{ type: "module", value: "auth module" }],
    };

    const request = buildContextRequest(plan, entities);

    expect(request.symbolSearch).toEqual(["jwt"]);
  });
});
