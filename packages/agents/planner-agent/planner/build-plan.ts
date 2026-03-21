import { PLANNER_RULES } from "./planner.rules";
import type { ExecutionPlan, PlanStep, PlanStepType } from "./planner.types";

export function buildExecutionPlan(
  intent: string,
  entities: string[],
): ExecutionPlan {
  const ruleSteps = PLANNER_RULES[intent] ?? ["NO_OP"];

  const steps: PlanStep[] = ruleSteps.map((type, index) => ({
    id: `${index}-${type}`,
    type,
    description: buildStepDescription(type, entities),
    entities,
  }));

  return {
    intent,
    steps,
  };
}

function buildStepDescription(type: PlanStepType, entities: string[]): string {
  const target = entities[0] ?? "codebase";

  switch (type) {
    case "SEARCH_SYMBOL":
      return `Locate relevant symbols for ${target}`;
    case "SEARCH_EMBEDDING":
      return `Search semantically related code for ${target}`;
    case "FETCH_DEPENDENCIES":
      return `Analyze dependency graph for ${target}`;
    case "ANALYZE_CODE":
      return `Analyze implementation of ${target}`;
    case "IDENTIFY_ISSUE":
      return `Identify issues in ${target}`;
    case "GENERATE_PATCH":
      return `Prepare code changes for ${target}`;
    case "EXPLAIN_CODE":
      return `Explain logic of ${target}`;
    case "NO_OP":
    default:
      return "No operation required";
  }
}
