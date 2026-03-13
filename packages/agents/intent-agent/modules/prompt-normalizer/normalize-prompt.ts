import { removeNoise } from "./noise-remover";
import { expandShorthand } from "./shorthand-expander";
import { detectReferences } from "./reference-detector";
import type { NormalizedPrompt } from "./prompt-normalizer.types";

const STOP_WORDS = new Set(["the", "a", "an", "in", "to", "for", "of"]);

export function normalizePrompt(prompt: string): NormalizedPrompt {
  const original = prompt;

  // Step 1: noise removal
  let text = removeNoise(prompt);

  // Step 2: case normalization to sentence case
  text = sentenceCase(text);

  // Step 3: shorthand expansion
  text = expandShorthand(text);

  // Step 4: reference detection (on expanded text)
  const references = detectReferences(text);

  // Step 5: tokenization (lowercase tokens, remove stopwords)
  const tokens = tokenize(text);

  return {
    original,
    normalized: text,
    tokens,
    references,
  };
}

function sentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const rawTokens = lower.match(/\b[a-z0-9_]+\b/gi) ?? [];

  return rawTokens.filter((token) => !STOP_WORDS.has(token));
}

