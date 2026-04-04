import { describe, it, expect } from "vitest";
import {
  extractJsonFromLLMResponse,
  parseReflectionLLMOutput,
  llmOutputToPlanAdjustments,
} from "../reflection/reflection-llm";

describe("reflection-llm", () => {
  it("extractJsonFromLLMResponse strips json fences", () => {
    const raw = '```json\n{"shouldRetry":true,"newStrategy":"widen search"}\n```';
    expect(extractJsonFromLLMResponse(raw)).toBe(
      '{"shouldRetry":true,"newStrategy":"widen search"}',
    );
  });

  it("extractJsonFromLLMResponse finds object in prose", () => {
    const raw = 'Here you go:\n{"shouldRetry":false,"newStrategy":"stop"}\nThanks.';
    expect(extractJsonFromLLMResponse(raw)).toBe(
      '{"shouldRetry":false,"newStrategy":"stop"}',
    );
  });

  it("parseReflectionLLMOutput validates shape", () => {
    const json = JSON.stringify({
      shouldRetry: true,
      newStrategy: "Try embedding search",
      planAdjustments: [
        { action: "add", newStepType: "SEARCH_EMBEDDING", reason: "broader" },
      ],
    });
    const r = parseReflectionLLMOutput(json);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.shouldRetry).toBe(true);
      expect(r.data.planAdjustments).toHaveLength(1);
    }
  });

  it("parseReflectionLLMOutput rejects invalid JSON", () => {
    const r = parseReflectionLLMOutput("not json");
    expect(r.ok).toBe(false);
  });

  it("llmOutputToPlanAdjustments maps fields", () => {
    const adj = llmOutputToPlanAdjustments({
      shouldRetry: true,
      newStrategy: "x",
      planAdjustments: [
        { action: "remove", targetStepType: "NO_OP", reason: "skip" },
      ],
    });
    expect(adj[0]).toEqual({
      action: "remove",
      targetStepType: "NO_OP",
      reason: "skip",
    });
  });
});
