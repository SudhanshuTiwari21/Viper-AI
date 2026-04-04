import { PLANNER_RULES } from "./planner.rules";
import type {
  ExecutionPlan,
  PlanStep,
  PlanStepType,
  PlannerMemoryContext,
} from "./planner.types";

/**
 * Build an execution plan from intent + entities.
 * When `memory` is provided the planner can:
 * - Resolve vague references ("it", "optimize that") via lastIntent/lastPatch
 * - Enrich entities with recently-touched files
 * - Skip steps that already succeeded (no duplicate search)
 */
export function buildExecutionPlan(
  intent: string,
  entities: string[],
  memory?: PlannerMemoryContext,
): ExecutionPlan {
  const resolvedEntities = resolveEntities(entities, memory);
  const ruleSteps = PLANNER_RULES[intent] ?? ["NO_OP"];

  const steps: PlanStep[] = ruleSteps.map((type, index) => ({
    id: `${index}-${type}`,
    type,
    description: buildStepDescription(type, resolvedEntities, memory),
    entities: resolvedEntities,
  }));

  return { intent, steps };
}

/**
 * If the user said something vague and entities are empty,
 * fill them from the most recent memory context.
 */
function resolveEntities(
  entities: string[],
  memory?: PlannerMemoryContext,
): string[] {
  if (entities.length > 0) return entities;
  if (!memory) return entities;

  if (memory.lastPatch && memory.lastPatch.files.length > 0) {
    return memory.lastPatch.files;
  }
  if (memory.lastIntent?.entities && memory.lastIntent.entities.length > 0) {
    return memory.lastIntent.entities;
  }
  if (memory.recentFiles.length > 0) {
    return memory.recentFiles.slice(0, 5);
  }
  return entities;
}

function buildStepDescription(
  type: PlanStepType,
  entities: string[],
  memory?: PlannerMemoryContext,
): string {
  const target = entities[0] ?? "codebase";
  const memHint = memory?.lastIntent
    ? ` (continuing: ${memory.lastIntent.summary})`
    : "";
  const reflHint = memory?.lastLoopReflection
    ? ` [prior loop: ${memory.lastLoopReflection.strategy}]`
    : "";

  switch (type) {
    case "SEARCH_SYMBOL":
      return `Locate relevant symbols for ${target}${memHint}${reflHint}`;
    case "SEARCH_EMBEDDING":
      return `Search semantically related code for ${target}${memHint}${reflHint}`;
    case "FETCH_DEPENDENCIES":
      return `Analyze dependency graph for ${target}${reflHint}`;
    case "ANALYZE_CODE":
      return `Analyze implementation of ${target}${memHint}${reflHint}`;
    case "IDENTIFY_ISSUE":
      return `Identify issues in ${target}${reflHint}`;
    case "GENERATE_PATCH":
      return `Prepare code changes for ${target}${reflHint}`;
    case "EXPLAIN_CODE":
      return `Explain logic of ${target}${reflHint}`;
    case "NO_OP":
    default:
      return "No operation required";
  }
}
