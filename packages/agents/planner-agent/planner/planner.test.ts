import { describe, expect, it } from "vitest";
import { buildExecutionPlan } from "./build-plan";

describe("buildExecutionPlan", () => {
  it("builds ordered steps for CODE_FIX", () => {
    const plan = buildExecutionPlan("CODE_FIX", ["login API"]);

    expect(plan.intent).toBe("CODE_FIX");
    expect(plan.steps).toHaveLength(5);
    expect(plan.steps.map((step) => step.type)).toEqual([
      "SEARCH_SYMBOL",
      "SEARCH_EMBEDDING",
      "FETCH_DEPENDENCIES",
      "IDENTIFY_ISSUE",
      "GENERATE_PATCH",
    ]);
    expect(plan.steps[0]?.id).toBe("0-SEARCH_SYMBOL");
    expect(plan.steps[4]?.id).toBe("4-GENERATE_PATCH");
  });

  it("maps GENERIC to NO_OP", () => {
    const plan = buildExecutionPlan("GENERIC", []);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.type).toBe("NO_OP");
    expect(plan.steps[0]?.description).toBe("No operation required");
  });

  it("passes entities to each step", () => {
    const entities = ["login API", "auth service"];
    const plan = buildExecutionPlan("CODE_SEARCH", entities);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.entities).toEqual(entities);
    expect(plan.steps[0]?.description).toContain("login API");
  });

  it("falls back to NO_OP for unknown intent", () => {
    const plan = buildExecutionPlan("SOMETHING_ELSE", ["x"]);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.type).toBe("NO_OP");
  });
});
