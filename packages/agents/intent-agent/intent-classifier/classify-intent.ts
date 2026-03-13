import type { NormalizedPrompt } from "../prompt-normalizer/prompt-normalizer.types";
import type { IntentClassification } from "./intent-classifier.types";
import { scoreIntents } from "./intent-scoring";

export function classifyIntent(prompt: NormalizedPrompt): IntentClassification {
  const { tokens } = prompt;

  const scored = scoreIntents(tokens);

  return {
    intentType: scored.intentType,
    confidence: scored.confidence,
    matchedKeywords: scored.matchedKeywords,
  };
}

