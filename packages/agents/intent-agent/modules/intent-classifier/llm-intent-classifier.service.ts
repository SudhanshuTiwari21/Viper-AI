/**
 * LLM-based intent classification. Replaces keyword scoring with a single
 * "Is this code-related? Which intent?" call for better generic vs code detection.
 */
import OpenAI from "openai";
import { hashString, createMemoryCache, withRetry } from "@repo/shared";
import type { IntentType } from "./intent-classifier.types";

const INTENT_TYPES: IntentType[] = [
  "GENERIC",
  "CODE_FIX",
  "FEATURE_IMPLEMENTATION",
  "REFACTOR",
  "CODE_EXPLANATION",
  "CODE_SEARCH",
  "DEPENDENCY_ANALYSIS",
  "TEST_GENERATION",
  "SECURITY_ANALYSIS",
  "FILE_EDIT",
  "PROJECT_SETUP",
];

const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const CACHE_TTL = Math.max(0, parseInt(process.env.INTENT_LLM_CACHE_TTL ?? "3600", 10));
const cache = createMemoryCache<IntentType>();

const SYSTEM_PROMPT = `You are an intent classifier for a coding assistant. Given a user message, respond with exactly one of these labels:

- GENERIC: Greetings, small talk, thanks, or anything not related to code or the codebase (e.g. "Hi!", "How are you?", "Thanks").
- CODE_FIX: User wants to fix a bug, error, or broken behavior.
- FEATURE_IMPLEMENTATION: User wants to add, implement, or build something new.
- REFACTOR: User wants to refactor, improve, clean up, or simplify code.
- CODE_EXPLANATION: User wants an explanation of how something works or what something does.
- CODE_SEARCH: User wants to find or locate something in the codebase.
- DEPENDENCY_ANALYSIS: User asks about dependencies or imports.
- TEST_GENERATION: User wants tests or testing.
- SECURITY_ANALYSIS: User asks about security or vulnerabilities.
- FILE_EDIT: User wants to edit, modify, or change a file.
- PROJECT_SETUP: User asks about setup, configuration, or installation.

Respond with only the label, nothing else. No punctuation, no explanation.`;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set it in .env to use LLM intent classification.",
    );
  }
  return new OpenAI({ apiKey });
}

function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 503;
}

function parseIntent(raw: string): IntentType {
  const trimmed = raw.trim().toUpperCase().replace(/[\s.]/g, "");
  const match = INTENT_TYPES.find(
    (t) => trimmed === t || trimmed.includes(t.replace(/_/g, "")),
  );
  return match ?? "GENERIC";
}

export async function classifyIntentWithLLM(userMessage: string): Promise<IntentType> {
  const key = hashString(`intent:${userMessage}`);
  if (CACHE_TTL > 0) {
    const cached = await cache.get(key);
    if (cached !== null) return cached;
  }

  const client = getClient();
  const response = await withRetry(
    () =>
      client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
      }),
    { maxRetries: 3, retryDelayMs: 500, isRetryable: isRetryableError },
  );

  const content = response.choices[0]?.message?.content?.trim() ?? "";
  const intent = parseIntent(content);
  if (CACHE_TTL > 0) {
    await cache.set(key, intent, CACHE_TTL);
  }
  return intent;
}
