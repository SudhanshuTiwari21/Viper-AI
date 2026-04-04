import { z } from "zod";
import type { PlanAdjustment } from "./reflection.types";

/**
 * Optional LLM output shape when callers run `buildReflectionPrompt` through an LLM.
 * The default `analyzeResult` path is **deterministic** and does **not** call any LLM.
 *
 * Use `parseReflectionLLMOutput` for retry-safe parsing (fenced JSON, tolerant extraction).
 */

export const ReflectionLLMOutputSchema = z.object({
  shouldRetry: z.boolean(),
  newStrategy: z.string().min(1),
  planAdjustments: z
    .array(
      z.object({
        action: z.enum(["add", "remove", "replace"]),
        targetStepType: z.string().optional(),
        newStepType: z.string().optional(),
        reason: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export type ReflectionLLMOutput = z.infer<typeof ReflectionLLMOutputSchema>;

/**
 * Strip markdown fences and isolate the outermost JSON object from model text.
 */
export function extractJsonFromLLMResponse(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

export type ParseReflectionResult =
  | { ok: true; data: ReflectionLLMOutput }
  | { ok: false; error: string };

/**
 * Parse and validate LLM JSON. Safe to call in a retry loop with backoff.
 */
export function parseReflectionLLMOutput(raw: string): ParseReflectionResult {
  try {
    const json = extractJsonFromLLMResponse(raw);
    const parsed: unknown = JSON.parse(json);
    const data = ReflectionLLMOutputSchema.parse(parsed);
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** Map validated LLM output into internal `PlanAdjustment` records. */
export function llmOutputToPlanAdjustments(
  out: ReflectionLLMOutput,
): PlanAdjustment[] {
  return (out.planAdjustments ?? []).map((a) => ({
    action: a.action,
    targetStepType: a.targetStepType,
    newStepType: a.newStepType,
    reason: a.reason,
  }));
}
