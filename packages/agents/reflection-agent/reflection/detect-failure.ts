import type { ExecutionObservation, DetectedFailure } from "./reflection.types";

/**
 * Analyze an ExecutionObservation and return all detected failures.
 * Returns an empty array when the execution looks healthy.
 */
export function detectFailures(obs: ExecutionObservation): DetectedFailure[] {
  const failures: DetectedFailure[] = [];

  detectRuntimeErrors(obs, failures);
  detectSkippedSteps(obs, failures);
  detectEmptyResult(obs, failures);
  detectNoContext(obs, failures);
  detectPatchFailures(obs, failures);
  detectPatchConflicts(obs, failures);
  detectWrongFiles(obs, failures);

  return failures;
}

// ---------------------------------------------------------------------------
// Individual detectors
// ---------------------------------------------------------------------------

function detectRuntimeErrors(obs: ExecutionObservation, out: DetectedFailure[]): void {
  for (const err of obs.capturedErrors) {
    out.push({
      kind: "runtime_error",
      message: err,
    });
  }
}

function detectSkippedSteps(obs: ExecutionObservation, out: DetectedFailure[]): void {
  const executedStepIds = new Set(obs.result.stepOutputs.map((s) => s.stepId));

  for (const step of obs.plan.steps) {
    if (!executedStepIds.has(step.id)) {
      out.push({
        kind: "step_skipped",
        stepId: step.id,
        message: `Step ${step.type} (${step.id}) was skipped — no tool registered`,
      });
    }
  }
}

function detectEmptyResult(obs: ExecutionObservation, out: DetectedFailure[]): void {
  const hasOutput = obs.result.stepOutputs.some((s) => s.result !== undefined);
  if (!hasOutput && obs.result.stepOutputs.length > 0) {
    out.push({
      kind: "empty_result",
      message: "All steps completed but none produced a result",
    });
  }
}

function detectNoContext(obs: ExecutionObservation, out: DetectedFailure[]): void {
  const ctx = obs.result.contextWindow;
  if (!ctx) return;

  const totalItems =
    (ctx.files?.length ?? 0) +
    (ctx.functions?.length ?? 0) +
    (ctx.snippets?.length ?? 0);

  if (totalItems === 0) {
    out.push({
      kind: "no_context_found",
      message: "Context retrieval returned zero files/functions/snippets",
    });
  }
}

function detectPatchFailures(obs: ExecutionObservation, out: DetectedFailure[]): void {
  const planHasPatch = obs.plan.steps.some((s) => s.type === "GENERATE_PATCH");
  if (!planHasPatch) return;

  if (!obs.patchGenerated) {
    out.push({
      kind: "patch_failed",
      message: "GENERATE_PATCH step ran but no patch was produced",
    });
    return;
  }

  if (!obs.patchValid) {
    out.push({
      kind: "patch_failed",
      message: "Patch was generated but failed validation",
      files: obs.filesChanged,
    });
  }
}

function detectPatchConflicts(obs: ExecutionObservation, out: DetectedFailure[]): void {
  if (!obs.capturedValidation) return;

  if (!obs.capturedValidation.valid && obs.capturedValidation.errors) {
    out.push({
      kind: "patch_conflicts",
      message: `Patch conflicts: ${obs.capturedValidation.errors.join("; ")}`,
      files: obs.filesChanged,
    });
  }
}

function detectWrongFiles(obs: ExecutionObservation, out: DetectedFailure[]): void {
  if (obs.filesChanged.length === 0) return;

  const entityFiles = new Set(
    obs.plan.steps.flatMap((s) => s.entities ?? []),
  );

  if (entityFiles.size === 0) return;

  const unexpected = obs.filesChanged.filter((f) => {
    return !([...entityFiles].some((e) => f.includes(e) || e.includes(f)));
  });

  if (unexpected.length > 0 && unexpected.length === obs.filesChanged.length) {
    out.push({
      kind: "wrong_files_edited",
      message: `All changed files [${unexpected.join(", ")}] are unrelated to target entities [${[...entityFiles].join(", ")}]`,
      files: unexpected,
    });
  }
}
