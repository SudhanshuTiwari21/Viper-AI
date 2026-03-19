import type { NormalizedPrompt } from "../prompt-normalizer/prompt-normalizer.types";
import type { IntentClassification } from "./intent-classifier.types";
import { classifyIntentWithLLM } from "./llm-intent-classifier.service";

/**
 * Classify user intent via LLM (generic vs code-related and specific intent type).
 * Replaces keyword-based scoring for better detection of greetings and code requests.
 */
export async function classifyIntent(prompt: NormalizedPrompt): Promise<IntentClassification> {
  const intentType = await classifyIntentWithLLM(prompt.normalized || prompt.original);
  return {
    intentType,
    confidence: 1,
    matchedKeywords: [],
  };
}
