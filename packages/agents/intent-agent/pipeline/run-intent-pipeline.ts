import type { IntentPipelineResult } from "./intent-pipeline.types";
import { normalizePrompt } from "../modules/prompt-normalizer";
import { classifyIntent } from "../modules/intent-classifier";
import { extractEntities } from "../modules/entity-extractor";
import { planTasks } from "../modules/task-planner";
import { buildContextRequest } from "../modules/context-request-builder";
import { buildContext } from "../modules/context-builder-adapter";
import { runReasoning } from "../modules/intent-reasoner";
import { generateIntentResponse } from "../modules/intent-response";
import type { CacheKeyMessage } from "@repo/shared";

export type IntentAgentCacheContext = {
  workspaceKey?: string;
  conversationId?: string;
  messages?: CacheKeyMessage[];
  contextHash?: string;
};

export async function runIntentPipeline(
  prompt: string,
  options?: {
    cacheContext?: IntentAgentCacheContext;
    skipReasoning?: boolean;
  },
): Promise<IntentPipelineResult> {
  const normalizedPrompt = normalizePrompt(prompt);
  const intent = await classifyIntent(normalizedPrompt, options?.cacheContext);
  const entities = extractEntities(normalizedPrompt);
  const tasks = planTasks(intent, entities);
  const contextRequest = buildContextRequest(tasks, entities);
  const contextBundle = options?.skipReasoning ? ({} as any) : await buildContext(contextRequest);

  const reasoning = options?.skipReasoning
    ? undefined
    : await runReasoning(
        prompt,
        intent,
        entities,
        tasks,
        contextBundle,
        options?.cacheContext,
      );

  const reasoningForResponse =
    reasoning ??
    ({
      detectedComponents: [],
      missingComponents: [],
      potentialIssues: [],
      recommendedNextStep: undefined,
    } as const);
  const response = generateIntentResponse(
    intent,
    entities,
    tasks,
    contextBundle,
    reasoningForResponse,
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
