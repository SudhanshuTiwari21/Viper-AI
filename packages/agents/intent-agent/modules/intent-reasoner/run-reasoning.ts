import type { IntentClassification } from "../intent-classifier/intent-classifier.types";
import type { EntityExtractionResult } from "../entity-extractor/entity-extractor.types";
import type { TaskPlan } from "../task-planner/task-planner.types";
import type { ContextBundle } from "../context-builder-adapter/context-builder.types";
import type { IntentReasoning } from "./reasoning.types";
import { buildReasoningPrompt } from "./reasoning-prompt-builder";
import { runReasoningPrompt } from "./llm-client.service";
import type { CacheKeyMessage } from "@repo/shared";

type IntentReasonerCacheContext = {
  workspaceKey?: string;
  conversationId?: string;
  messages?: CacheKeyMessage[];
  contextHash?: string;
};

export async function runReasoning(
  userPrompt: string,
  intent: IntentClassification,
  entities: EntityExtractionResult,
  tasks: TaskPlan,
  context: ContextBundle,
  cacheContext?: IntentReasonerCacheContext,
): Promise<IntentReasoning> {
  const prompt = buildReasoningPrompt(userPrompt, intent, entities, tasks, context);
  const rawResponse = await runReasoningPrompt(prompt, {
    workspaceKey: cacheContext?.workspaceKey,
    conversationId: cacheContext?.conversationId,
    messages: cacheContext?.messages,
    contextHash: cacheContext?.contextHash,
    intentType: intent.intentType,
  });
  return parseReasoningResponse(rawResponse);
}

function parseReasoningResponse(raw: string): IntentReasoning {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (parsed && typeof parsed === "object" && "detectedComponents" in parsed) {
        const p = parsed as Record<string, unknown>;
        return {
          detectedComponents: Array.isArray(p.detectedComponents)
            ? (p.detectedComponents as string[])
            : [],
          missingComponents: Array.isArray(p.missingComponents)
            ? (p.missingComponents as string[])
            : [],
          potentialIssues: Array.isArray(p.potentialIssues)
            ? (p.potentialIssues as string[])
            : [],
          recommendedNextStep:
            typeof p.recommendedNextStep === "string"
              ? p.recommendedNextStep
              : undefined,
        };
      }
    } catch {
      // fall through to default
    }
  }
  return {
    detectedComponents: [],
    missingComponents: [],
    potentialIssues: [],
  };
}
