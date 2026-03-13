import type { IntentClassification, IntentType } from "./intent-classifier.types";
import { INTENT_KEYWORD_RULES } from "./intent-keyword-rules";

export function scoreIntents(
  tokens: string[],
): { intentType: IntentType; confidence: number; matchedKeywords: string[] } {
  const tokenSet = new Set(tokens.map((t) => t.toLowerCase()));

  let bestIntent: IntentType | null = null;
  let bestScore = 0;
  let bestMatched: string[] = [];

  const totalTokens = tokens.length || 1;

  (Object.keys(INTENT_KEYWORD_RULES) as IntentType[]).forEach((intent) => {
    const keywords = INTENT_KEYWORD_RULES[intent];
    const matched = keywords.filter((keyword) =>
      tokenSet.has(keyword.toLowerCase()),
    );

    const score = matched.length / totalTokens;

    if (score > bestScore || bestIntent === null) {
      bestIntent = intent;
      bestScore = score;
      bestMatched = matched;
    }
  });

  return {
    intentType: bestIntent ?? "CODE_SEARCH",
    confidence: bestScore,
    matchedKeywords: bestMatched,
  };
}

