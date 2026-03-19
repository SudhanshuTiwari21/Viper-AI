import type { IntentPipelineResult } from "./intent-pipeline.types";
import { normalizePrompt } from "../modules/prompt-normalizer";
import { classifyIntent } from "../modules/intent-classifier";
import { extractEntities } from "../modules/entity-extractor";
import { planTasks } from "../modules/task-planner";
import { buildContextRequest } from "../modules/context-request-builder";
import { buildContext } from "../modules/context-builder-adapter";
import { runReasoning } from "../modules/intent-reasoner";
import { generateIntentResponse } from "../modules/intent-response";

export async function runIntentPipeline(
  prompt: string,
): Promise<IntentPipelineResult> {
  const normalizedPrompt = normalizePrompt(prompt);
  const intent = await classifyIntent(normalizedPrompt);
  const entities = extractEntities(normalizedPrompt);
  const tasks = planTasks(intent, entities);
  const contextRequest = buildContextRequest(tasks, entities);
  const contextBundle = await buildContext(contextRequest);
  const reasoning = await runReasoning(prompt, intent, entities, tasks, contextBundle);
  const response = generateIntentResponse(
    intent,
    entities,
    tasks,
    contextBundle,
    reasoning,
  );

  return {
    normalizedPrompt,
    intent,
    entities,
    tasks,
    contextRequest,
    contextBundle,
    reasoning,
    response,
  };
}
