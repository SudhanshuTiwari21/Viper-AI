import type OpenAI from "openai";

export type OpenAIErrorClass = "retryable" | "fatal";

/** Structured classification for workflow logs; aligns with OpenAIErrorClass for errors. */
export type FailoverErrorClass = OpenAIErrorClass | "empty_stream" | "empty_completion";

export function classifyOpenAIError(err: unknown): OpenAIErrorClass {
  const status = (err as { status?: number })?.status;

  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422) {
    return "fatal";
  }
  if (status === 429 || status === 503) {
    return "retryable";
  }
  if (typeof status === "number" && status >= 500 && status < 600) {
    return "retryable";
  }

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("overloaded") ||
    lower.includes("server_error") ||
    lower.includes("server error") ||
    lower.includes("service unavailable") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("socket hang up")
  ) {
    return "retryable";
  }

  return "fatal";
}

export function orderedModelIdsForFailover(
  primaryModelId: string,
  fallbackModelIds: string[],
  maxAttempts: number,
): string[] {
  const cap = Math.max(1, maxAttempts);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [primaryModelId, ...fallbackModelIds]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= cap) break;
  }
  return out;
}

function errorReason(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 500);
  return String(err).slice(0, 500);
}

export interface FailoverMeta {
  from_model: string;
  to_model: string;
  attempt: number;
  reason: string;
  error_class: FailoverErrorClass;
}

export async function runChatCompletionWithFailover(params: {
  client: OpenAI;
  primaryModelId: string;
  fallbackModelIds: string[];
  maxAttempts: number;
  buildRequest: (model: string) => OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;
  onFallback?: (meta: FailoverMeta) => void;
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const order = orderedModelIdsForFailover(
    params.primaryModelId,
    params.fallbackModelIds,
    params.maxAttempts,
  );
  let lastErr: unknown;
  for (let i = 0; i < order.length; i++) {
    const model = order[i]!;
    try {
      const req = params.buildRequest(model);
      const res = await params.client.chat.completions.create(req);
      const text = res.choices[0]?.message?.content?.trim() ?? "";
      if (!text && i < order.length - 1) {
        const next = order[i + 1]!;
        params.onFallback?.({
          from_model: model,
          to_model: next,
          attempt: i + 2,
          reason: "empty_completion",
          error_class: "empty_completion",
        });
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      const cls = classifyOpenAIError(err);
      if (cls === "fatal" || i === order.length - 1) {
        throw err;
      }
      const next = order[i + 1]!;
      params.onFallback?.({
        from_model: model,
        to_model: next,
        attempt: i + 2,
        reason: errorReason(err),
        error_class: cls,
      });
    }
  }
  throw lastErr ?? new Error("runChatCompletionWithFailover: exhausted models");
}

export type StreamBody = Omit<OpenAI.Chat.ChatCompletionCreateParamsStreaming, "model" | "stream">;

/**
 * Text-delta streaming with model failover (direct LLM / narration). Retries the next model when
 * the API throws a retryable error or when the stream yields no text deltas (empty body).
 */
export async function runStreamingTextChatWithFailover(params: {
  client: OpenAI;
  primaryModelId: string;
  fallbackModelIds: string[];
  maxAttempts: number;
  streamBody: StreamBody;
  signal?: AbortSignal;
  onFallback?: (meta: FailoverMeta) => void;
  onDelta: (text: string) => void;
}): Promise<{ modelUsed: string }> {
  const order = orderedModelIdsForFailover(
    params.primaryModelId,
    params.fallbackModelIds,
    params.maxAttempts,
  );
  outer: for (let i = 0; i < order.length; i++) {
    const model = order[i]!;
    try {
      const stream = await params.client.chat.completions.create({
        ...params.streamBody,
        model,
        stream: true,
      });
      let sawDelta = false;
      for await (const chunk of stream) {
        if (params.signal?.aborted) break;
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          sawDelta = true;
          params.onDelta(delta);
        }
      }
      if (!sawDelta && i < order.length - 1) {
        const next = order[i + 1]!;
        params.onFallback?.({
          from_model: model,
          to_model: next,
          attempt: i + 2,
          reason: "empty_stream",
          error_class: "empty_stream",
        });
        continue outer;
      }
      return { modelUsed: model };
    } catch (err) {
      const cls = classifyOpenAIError(err);
      if (cls === "fatal" || i === order.length - 1) {
        throw err;
      }
      const next = order[i + 1]!;
      params.onFallback?.({
        from_model: model,
        to_model: next,
        attempt: i + 2,
        reason: errorReason(err),
        error_class: cls,
      });
    }
  }
  throw new Error("runStreamingTextChatWithFailover: exhausted models");
}

/**
 * OpenAI streaming create with failover on **retryable thrown errors only** (agentic tool stream).
 * Does not treat an empty stream as retryable — tool deltas may carry only tool_calls.
 */
export async function createAgenticChatStreamWithFailover(params: {
  client: OpenAI;
  primaryModelId: string;
  fallbackModelIds: string[];
  maxAttempts: number;
  streamBody: StreamBody;
  onFallback?: (meta: FailoverMeta) => void;
}): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  const order = orderedModelIdsForFailover(
    params.primaryModelId,
    params.fallbackModelIds,
    params.maxAttempts,
  );
  let lastErr: unknown;
  for (let i = 0; i < order.length; i++) {
    const model = order[i]!;
    try {
      return await params.client.chat.completions.create({
        ...params.streamBody,
        model,
        stream: true,
      });
    } catch (err) {
      lastErr = err;
      const cls = classifyOpenAIError(err);
      if (cls === "fatal" || i === order.length - 1) {
        throw err;
      }
      const next = order[i + 1]!;
      params.onFallback?.({
        from_model: model,
        to_model: next,
        attempt: i + 2,
        reason: errorReason(err),
        error_class: cls,
      });
    }
  }
  throw lastErr ?? new Error("createAgenticChatStreamWithFailover: exhausted models");
}
