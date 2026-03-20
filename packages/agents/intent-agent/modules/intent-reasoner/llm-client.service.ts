/**
 * Real LLM call for intent reasoning. Uses OpenAI Chat Completions API.
 * Includes response caching and retry on 429/503.
 */
import OpenAI from "openai";
import { buildCacheKey, type CacheKeyMessage, createMemoryCache, withRetry } from "@repo/shared";

const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const DISABLE_INTENT_CACHE =
  (process.env.DISABLE_INTENT_CACHE ?? "false").toLowerCase() === "true";
const LLM_CACHE_TTL = DISABLE_INTENT_CACHE
  ? 0
  : Math.max(0, parseInt(process.env.LLM_CACHE_TTL ?? "3600", 10));

const cache = createMemoryCache<string>();

type IntentReasonerCacheContext = {
  workspaceKey?: string;
  conversationId?: string;
  messages?: CacheKeyMessage[];
  intentType?: string;
  contextHash?: string;
};

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set it in .env to use the Intent Reasoner LLM.",
    );
  }
  return new OpenAI({ apiKey });
}

function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 503;
}

export async function runReasoningPrompt(
  prompt: string,
  cacheContext?: IntentReasonerCacheContext,
): Promise<string> {
  const key = `intent-reasoner:${buildCacheKey({
    workspaceKey: cacheContext?.workspaceKey,
    conversationId: cacheContext?.conversationId,
    prompt,
    messages: cacheContext?.messages,
    intentType: cacheContext?.intentType ?? "INTENT_REASONER",
    contextHash: cacheContext?.contextHash ?? "",
  })}`;
  const canUseCache =
    LLM_CACHE_TTL > 0 && Boolean(cacheContext?.conversationId);
  if (canUseCache) {
    const cached = await cache.get(key);
    if (cached !== null) {
      if (process.env.NODE_ENV !== "test") {
        console.log("[Viper] LLM cache hit");
      }
      return cached;
    }
  }
  if (process.env.NODE_ENV !== "test") {
    console.log("[Viper] LLM cache miss");
  }

  try {
    const client = getClient();
    const response = await withRetry(
      () =>
        client.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a software architecture reasoning engine. Analyze the given context and respond with a JSON object containing: detectedComponents (string[]), missingComponents (string[]), potentialIssues (string[]), recommendedNextStep (string). Return only valid JSON, no markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        }),
      { maxRetries: 3, retryDelayMs: 500, isRetryable: isRetryableError },
    );
    const content = response.choices[0]?.message?.content ?? "";
    const result = content.trim();
    if (canUseCache) {
      await cache.set(key, result, LLM_CACHE_TTL);
    }
    return result;
  } catch (error) {
    console.error("[Viper] LLM provider error", error);
    throw new Error(
      "LLM request failed. Check OPENAI_API_KEY and network.",
    );
  }
}
