import type {
  EvalCase,
  CaseResult,
  WorkflowStageInput,
  WorkflowStageExpect,
} from "../types.js";

// ---------------------------------------------------------------------------
// Canonical set of workflow stages that must be present before a release.
// This list is the authoritative "must not regress" set.
// Source: apps/backend/src/types/workflow-log-schema.ts — VALID_WORKFLOW_STAGES.
// Update this list when new stages are added and their presence becomes a gate.
// ---------------------------------------------------------------------------
export const REQUIRED_WORKFLOW_STAGES: ReadonlySet<string> = new Set([
  // Core request lifecycle
  "request:start",
  "request:complete",
  "intent:start",
  "intent:complete",
  "route:direct-llm",
  "route:agentic",
  "result:emitted",
  // Observability
  "quota:check",
  "entitlement:checked",
  "entitlement:denied",
  "usage:event:emitted",
  // Editor features (G.36 / G.37)
  "editor:inline-complete:requested",
  "editor:inline-complete:completed",
  "editor:inline-edit:requested",
  "editor:inline-edit:completed",
  // Git assistant (G.38)
  "git:assistant:requested",
  "git:assistant:completed",
  // Test assistant (G.39)
  "testing:assistant:requested",
  "testing:assistant:completed",
  // Privacy boundary (G.40)
  "privacy:path:blocked",
  // Billing
  "billing:webhook:applied",
]);

export async function runWorkflowStageCase(
  c: EvalCase<WorkflowStageInput, WorkflowStageExpect>,
): Promise<CaseResult> {
  const start = Date.now();
  try {
    const present = REQUIRED_WORKFLOW_STAGES.has(c.input.stage);

    if (present !== c.expect.present) {
      return {
        id: c.id,
        description: c.description,
        status: "fail",
        durationMs: Date.now() - start,
        error: `expected stage "${c.input.stage}" present=${c.expect.present} but got present=${present}`,
        actual: { present },
      };
    }

    return {
      id: c.id,
      description: c.description,
      status: "pass",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      id: c.id,
      description: c.description,
      status: "error",
      durationMs: Date.now() - start,
      error: String(err),
    };
  }
}
