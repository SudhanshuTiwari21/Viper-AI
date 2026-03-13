import type { NormalizedPrompt } from "../modules/prompt-normalizer/prompt-normalizer.types";
import type { IntentClassification } from "../modules/intent-classifier/intent-classifier.types";
import type { EntityExtractionResult } from "../modules/entity-extractor/entity-extractor.types";
import type { TaskPlan } from "../modules/task-planner/task-planner.types";
import type { ContextRequest } from "../modules/context-request-builder/context-request.types";
import type { ContextBundle } from "../modules/context-builder-adapter/context-builder.types";
import type { IntentReasoning } from "../modules/intent-reasoner/reasoning.types";
import type { IntentResponse } from "../modules/intent-response/response.types";

export interface IntentPipelineResult {
  normalizedPrompt: NormalizedPrompt;
  intent: IntentClassification;
  entities: EntityExtractionResult;
  tasks: TaskPlan;
  contextRequest: ContextRequest;
  contextBundle: ContextBundle;
  reasoning: IntentReasoning;
  response: IntentResponse;
}
