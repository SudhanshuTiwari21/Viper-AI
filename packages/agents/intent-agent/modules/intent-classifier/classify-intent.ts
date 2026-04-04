import type { NormalizedPrompt } from "../prompt-normalizer/prompt-normalizer.types";
import type { IntentClassification } from "./intent-classifier.types";
import { classifyIntentWithLLM } from "./llm-intent-classifier.service";
import type { CacheKeyMessage } from "@repo/shared";

export type IntentClassifierCacheContext = {
  workspaceKey?: string;
  conversationId?: string;
  messages?: CacheKeyMessage[];
  contextHash?: string;
};

/**
 * Classify user intent via LLM (generic vs code-related and specific intent type).
 * Replaces keyword-based scoring for better detection of greetings and code requests.
 */
export async function classifyIntent(
  prompt: NormalizedPrompt,
  cacheContext?: IntentClassifierCacheContext,
): Promise<IntentClassification> {
  const userMessage = prompt.normalized || prompt.original;
  const intentType = cacheContext
    ? await classifyIntentWithLLM(userMessage, cacheContext)
    : await classifyIntentWithLLM(userMessage);
  return {
    intentType,
    confidence: 1,
    matchedKeywords: [],
  };
}
