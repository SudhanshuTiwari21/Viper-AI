import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import {
  classifyOpenAIError,
  createAgenticChatStreamWithFailover,
  orderedModelIdsForFailover,
  runChatCompletionWithFailover,
  runStreamingTextChatWithFailover,
} from "./openai-chat-with-failover.js";

describe("classifyOpenAIError", () => {
  it("429 and 503 are retryable", () => {
    expect(classifyOpenAIError({ status: 429 })).toBe("retryable");
    expect(classifyOpenAIError({ status: 503 })).toBe("retryable");
    expect(classifyOpenAIError({ status: 500 })).toBe("retryable");
  });

  it("401/400 are fatal", () => {
    expect(classifyOpenAIError({ status: 401 })).toBe("fatal");
    expect(classifyOpenAIError({ status: 400 })).toBe("fatal");
  });

  it("matches rate limit message heuristics", () => {
    expect(classifyOpenAIError(new Error("Rate limit exceeded"))).toBe("retryable");
    expect(classifyOpenAIError(new Error("server_error from provider"))).toBe("retryable");
  });
});

describe("orderedModelIdsForFailover", () => {
  it("de-dupes and caps by maxAttempts", () => {
    expect(orderedModelIdsForFailover("a", ["a", "b", "c"], 2)).toEqual(["a", "b"]);
    expect(orderedModelIdsForFailover("m", ["m", "n"], 3)).toEqual(["m", "n"]);
  });
});

describe("runChatCompletionWithFailover", () => {
  it("uses second model when first throws 429", async () => {
    const create = vi.fn(
      async (req: { model: string }): Promise<{ choices: Array<{ message?: { content?: string } }> }> => {
        if (req.model === "m1") {
          const err = Object.assign(new Error("rate"), { status: 429 });
          throw err;
        }
        return { choices: [{ message: { content: "hello" } }] };
      },
    );
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const onFallback = vi.fn();
    const res = await runChatCompletionWithFailover({
      client,
      primaryModelId: "m1",
      fallbackModelIds: ["m2"],
      maxAttempts: 3,
      onFallback,
      buildRequest: (model) =>
        ({
          model,
          messages: [{ role: "user", content: "x" }],
        }) as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
    });
    expect(res.choices[0]?.message?.content).toBe("hello");
    expect(create.mock.calls.map((c) => (c[0] as { model: string }).model)).toEqual(["m1", "m2"]);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it("does not fallback on 401", async () => {
    const create = vi.fn(async () => {
      throw Object.assign(new Error("auth"), { status: 401 });
    });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    await expect(
      runChatCompletionWithFailover({
        client,
        primaryModelId: "m1",
        fallbackModelIds: ["m2"],
        maxAttempts: 3,
        buildRequest: (model) =>
          ({
            model,
            messages: [{ role: "user", content: "x" }],
          }) as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
      }),
    ).rejects.toThrow("auth");
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("runStreamingTextChatWithFailover", () => {
  it("retries on empty stream", async () => {
    const create = vi.fn(async (args: { model: string; stream: boolean }) => {
      if (args.model === "m1") {
        return (async function* () {
          /* empty */
        })();
      }
      return (async function* () {
        yield {
          choices: [{ delta: { content: "ok" } }],
        } as OpenAI.Chat.Completions.ChatCompletionChunk;
      })();
    });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const deltas: string[] = [];
    await runStreamingTextChatWithFailover({
      client,
      primaryModelId: "m1",
      fallbackModelIds: ["m2"],
      maxAttempts: 3,
      streamBody: { messages: [{ role: "user", content: "x" }], temperature: 0 },
      onDelta: (t) => deltas.push(t),
    });
    expect(deltas.join("")).toBe("ok");
    expect(create.mock.calls.map((c) => (c[0] as { model: string }).model)).toEqual(["m1", "m2"]);
  });
});

describe("createAgenticChatStreamWithFailover", () => {
  it("fallbacks streaming create on retryable error", async () => {
    const create = vi.fn(async (args: { model: string }) => {
      if (args.model === "m1") {
        throw Object.assign(new Error("overload"), { status: 503 });
      }
      return (async function* () {
        yield { choices: [{ delta: { content: "z" } }] } as OpenAI.Chat.Completions.ChatCompletionChunk;
      })();
    });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const stream = await createAgenticChatStreamWithFailover({
      client,
      primaryModelId: "m1",
      fallbackModelIds: ["m2"],
      maxAttempts: 3,
      streamBody: { messages: [{ role: "user", content: "x" }], temperature: 0.2 },
    });
    const chunks: string[] = [];
    for await (const c of stream) {
      const d = c.choices[0]?.delta?.content;
      if (d) chunks.push(d);
    }
    expect(chunks.join("")).toBe("z");
    expect(create.mock.calls.map((c) => (c[0] as { model: string }).model)).toEqual(["m1", "m2"]);
  });
});
