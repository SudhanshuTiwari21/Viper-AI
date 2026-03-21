import type {
  ExecutionObservation,
  ReflectionResult,
  PlanAdjustment,
  DetectedFailure,
} from "./reflection.types";
import { detectFailures } from "./detect-failure";

/**
 * Analyze execution results and produce a ReflectionResult.
 * Purely deterministic — no LLM calls.
 * Maps detected failures to concrete plan adjustments and a retry strategy.
 */
export function analyzeResult(obs: ExecutionObservation): ReflectionResult {
  const failures = detectFailures(obs);

  if (failures.length === 0) {
    return {
      success: true,
      failures: [],
      shouldRetry: false,
      newStrategy: "",
      planAdjustments: [],
      summary: "Execution succeeded with no detected issues.",
    };
  }

  const adjustments = buildAdjustments(failures, obs);
  const strategy = buildStrategy(failures);
  const retriable = isRetriable(failures);

  return {
    success: false,
    failures,
    shouldRetry: retriable,
    newStrategy: strategy,
    planAdjustments: adjustments,
    summary: buildSummary(failures),
  };
}

// ---------------------------------------------------------------------------
// Strategy generation — maps failure patterns to high-level strategies
// ---------------------------------------------------------------------------

function buildStrategy(failures: DetectedFailure[]): string {
  const kinds = new Set(failures.map((f) => f.kind));

  if (kinds.has("no_context_found")) {
    return "Broaden search: use embedding-based search and expand entity scope";
  }
  if (kinds.has("patch_conflicts")) {
    return "Re-read target files for latest content, then regenerate patch";
  }
  if (kinds.has("patch_failed")) {
    return "Analyze code more deeply before patch generation; add IDENTIFY_ISSUE step";
  }
  if (kinds.has("wrong_files_edited")) {
    return "Refine entity targeting: re-run symbol search with narrower scope";
  }
  if (kinds.has("empty_result")) {
    return "Add missing analysis steps to produce actionable output";
  }
  if (kinds.has("step_skipped")) {
    return "Replace skipped steps with available alternatives";
  }
  if (kinds.has("runtime_error")) {
    return "Investigate runtime error and retry with additional error context";
  }
  return "Retry with broader context retrieval";
}

// ---------------------------------------------------------------------------
// Plan adjustments — concrete step mutations
// ---------------------------------------------------------------------------

function buildAdjustments(
  failures: DetectedFailure[],
  obs: ExecutionObservation,
): PlanAdjustment[] {
  const adjustments: PlanAdjustment[] = [];
  const kinds = new Set(failures.map((f) => f.kind));
  const planStepTypes = new Set(obs.plan.steps.map((s) => s.type));

  if (kinds.has("no_context_found") && !planStepTypes.has("SEARCH_EMBEDDING")) {
    adjustments.push({
      action: "add",
      newStepType: "SEARCH_EMBEDDING",
      reason: "Symbol search found nothing; try semantic search",
    });
  }

  if (kinds.has("patch_failed") && !planStepTypes.has("IDENTIFY_ISSUE")) {
    adjustments.push({
      action: "add",
      newStepType: "IDENTIFY_ISSUE",
      reason: "Patch failed — need deeper issue analysis before generating patch",
    });
  }

  if (kinds.has("patch_conflicts")) {
    adjustments.push({
      action: "add",
      newStepType: "ANALYZE_CODE",
      reason: "Patch had conflicts — re-read files for latest state",
    });
  }

  if (
    kinds.has("wrong_files_edited") &&
    !planStepTypes.has("SEARCH_EMBEDDING")
  ) {
    adjustments.push({
      action: "replace",
      targetStepType: "SEARCH_SYMBOL",
      newStepType: "SEARCH_EMBEDDING",
      reason: "Symbol search targeted wrong files; switch to semantic search",
    });
  }

  for (const f of failures) {
    if (f.kind === "step_skipped" && f.stepId) {
      const step = obs.plan.steps.find((s) => s.id === f.stepId);
      if (step) {
        adjustments.push({
          action: "remove",
          targetStepType: step.type,
          reason: `Step ${step.type} has no registered tool — remove to avoid skips`,
        });
      }
    }
  }

  return adjustments;
}

// ---------------------------------------------------------------------------
// Retriability — some failures are worth retrying, others aren't
// ---------------------------------------------------------------------------

function isRetriable(failures: DetectedFailure[]): boolean {
  const unretriable = new Set<string>(["step_skipped"]);
  const hasRetriable = failures.some((f) => !unretriable.has(f.kind));
  return hasRetriable;
}

// ---------------------------------------------------------------------------
// Human-readable summary
// ---------------------------------------------------------------------------

function buildSummary(failures: DetectedFailure[]): string {
  const lines = failures.map(
    (f) => `[${f.kind}] ${f.message}`,
  );
  return `Detected ${failures.length} issue(s):\n${lines.join("\n")}`;
}
