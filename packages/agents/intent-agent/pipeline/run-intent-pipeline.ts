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
import type { TaskPlan } from "../modules/task-planner/task-planner.types";
import type { ContextBundle } from "../modules/context-builder-adapter/context-builder.types";
import type { ContextRequest } from "../modules/context-request-builder/context-request.types";
import type { IntentReasoning } from "../modules/intent-reasoner/reasoning.types";

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
    /** When true (default), skips LLM reasoning and context bundle fetch. */
    skipReasoning?: boolean;
    /** When true (default), skips task planning, context request, and context builder (pure intent path). */
    skipContextRequest?: boolean;
  },
): Promise<IntentPipelineResult> {
  const skipReasoning = options?.skipReasoning ?? true;
  const skipContextRequest = options?.skipContextRequest ?? true;

  const normalizedPrompt = normalizePrompt(prompt);
  const intent = await classifyIntent(normalizedPrompt, options?.cacheContext);
  const entities = extractEntities(normalizedPrompt);

  let tasks: TaskPlan | undefined;
  let contextRequest: ContextRequest | undefined;
  let contextBundle: ContextBundle = {} as ContextBundle;
  let reasoning: IntentReasoning | undefined;

  if (!skipContextRequest) {
    tasks = planTasks(intent, entities);
    contextRequest = buildContextRequest(tasks, entities);
    if (!skipReasoning) {
      contextBundle = await buildContext(contextRequest);
      reasoning = await runReasoning(
        prompt,
        intent,
        entities,
        tasks,
        contextBundle,
        options?.cacheContext,
      );
    }
  }

  const tasksForResponse: TaskPlan = tasks ?? {
    intent: intent.intentType,
    tasks: [],
  };
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
    tasksForResponse,
    contextBundle,
    reasoningForResponse,
  );

  const result: IntentPipelineResult = {
    normalizedPrompt,
    intent,
    entities,
    response,
  };

  if (tasks !== undefined) {
    result.tasks = tasks;
  }
  if (contextRequest !== undefined) {
    result.contextRequest = contextRequest;
  }
  if (!skipContextRequest) {
    result.contextBundle = contextBundle;
  }
  if (reasoning !== undefined) {
    result.reasoning = reasoning;
  }

  return result;
}
