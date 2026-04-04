import type { ReflectionResult, ExecutionObservation } from "./reflection.types";

/**
 * Build a structured reflection prompt for an **optional** LLM pass.
 *
 * **Default pipeline:** `analyzeResult()` is fully **deterministic** (no LLM). It drives
 * `refinePlan()` directly. This prompt is for callers who want a second opinion or richer
 * strategy text — pair it with `parseReflectionLLMOutput()` from `reflection-llm.ts`
 * for structured JSON + Zod validation.
 *
 * Returns empty string if the reflection indicates success.
 */
export function buildReflectionPrompt(
  reflection: ReflectionResult,
  obs: ExecutionObservation,
  iteration: number,
): string {
  if (reflection.success) return "";

  const sections: string[] = [
    `SELF-CORRECTION (attempt ${iteration + 1})`,
    "",
    "The previous attempt did not succeed.",
    "",
  ];

  sections.push("FAILURES:");
  for (const f of reflection.failures) {
    sections.push(`  - [${f.kind}] ${f.message}`);
    if (f.files && f.files.length > 0) {
      sections.push(`    files: ${f.files.join(", ")}`);
    }
  }
  sections.push("");

  if (obs.capturedValidation && !obs.capturedValidation.valid) {
    sections.push("VALIDATION ERRORS:");
    for (const err of obs.capturedValidation.errors ?? []) {
      sections.push(`  - ${err}`);
    }
    sections.push("");
  }

  if (obs.capturedErrors.length > 0) {
    sections.push("RUNTIME ERRORS:");
    for (const err of obs.capturedErrors) {
      sections.push(`  - ${err}`);
    }
    sections.push("");
  }

  sections.push(`STRATEGY: ${reflection.newStrategy}`);
  sections.push("");

  if (reflection.planAdjustments.length > 0) {
    sections.push("PLAN ADJUSTMENTS:");
    for (const adj of reflection.planAdjustments) {
      const target = adj.targetStepType ? ` ${adj.targetStepType}` : "";
      const next = adj.newStepType ? ` → ${adj.newStepType}` : "";
      sections.push(`  - ${adj.action}${target}${next}: ${adj.reason}`);
    }
    sections.push("");
  }

  const logsTail = obs.result.logs.slice(-5);
  if (logsTail.length > 0) {
    sections.push("EXECUTION LOGS (last 5):");
    for (const l of logsTail) {
      sections.push(`  ${l}`);
    }
    sections.push("");
  }

  sections.push("What should be done differently this time?");

  return sections.join("\n");
}
