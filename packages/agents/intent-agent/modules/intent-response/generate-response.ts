import type { IntentClassification } from "../intent-classifier/intent-classifier.types";
import type { EntityExtractionResult } from "../entity-extractor/entity-extractor.types";
import type { TaskPlan } from "../task-planner/task-planner.types";
import type { ContextBundle } from "../context-builder-adapter/context-builder.types";
import type { IntentReasoning } from "../intent-reasoner/reasoning.types";
import type { IntentResponse } from "./response.types";

export function generateIntentResponse(
  intent: IntentClassification,
  entities: EntityExtractionResult,
  tasks: TaskPlan,
  context: ContextBundle,
  reasoning: IntentReasoning,
): IntentResponse {
  const summary = buildSummary(intent, entities, tasks);
  const relevantFiles = context.files?.length ? [...context.files] : undefined;

  const response: IntentResponse = {
    intent: intent.intentType,
    summary,
  };

  if (relevantFiles?.length) {
    response.relevantFiles = relevantFiles;
  }
  if (reasoning.detectedComponents?.length) {
    response.detectedComponents = reasoning.detectedComponents;
  }
  if (reasoning.missingComponents?.length) {
    response.missingComponents = reasoning.missingComponents;
  }
  if (reasoning.potentialIssues?.length) {
    response.potentialIssues = reasoning.potentialIssues;
  }
  if (reasoning.recommendedNextStep) {
    response.recommendedNextStep = reasoning.recommendedNextStep;
  }

  return response;
}

function buildSummary(
  intent: IntentClassification,
  entities: EntityExtractionResult,
  tasks: TaskPlan,
): string {
  const entityList =
    entities.entities?.map((e) => e.value).join(", ") || "none specified";
  const taskCount = tasks.tasks?.length ?? 0;

  return `Intent: ${intent.intentType}. Entities: ${entityList}. ${taskCount} task(s) planned.`;
}
