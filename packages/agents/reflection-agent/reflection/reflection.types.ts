import type { ExecutionPlan, PlanStep } from "@repo/planner-agent";
import type { ExecutionResult, StepOutput } from "@repo/execution-engine";

// ---------------------------------------------------------------------------
// Failure detection
// ---------------------------------------------------------------------------

export type FailureKind =
  | "patch_failed"
  | "patch_conflicts"
  | "wrong_files_edited"
  | "missing_logic"
  | "step_skipped"
  | "no_context_found"
  | "empty_result"
  | "runtime_error";

export interface DetectedFailure {
  kind: FailureKind;
  stepId?: string;
  message: string;
  /** Which files were involved (if applicable). */
  files?: string[];
}

// ---------------------------------------------------------------------------
// Observation — raw facts collected after execution
// ---------------------------------------------------------------------------

export interface ExecutionObservation {
  plan: ExecutionPlan;
  result: ExecutionResult;
  /** Captured stream events relevant to failure analysis. */
  capturedErrors: string[];
  capturedValidation?: { valid: boolean; errors?: string[] };
  patchGenerated: boolean;
  patchValid: boolean;
  filesChanged: string[];
  /** Duration of the entire execution pass. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Reflection — the agent's analysis of what went wrong
// ---------------------------------------------------------------------------

export interface ReflectionResult {
  /** Did the execution succeed (no failures detected)? */
  success: boolean;
  /** Detected failure modes. */
  failures: DetectedFailure[];
  /** Should the system retry with a new plan? */
  shouldRetry: boolean;
  /** High-level strategy for the next attempt. */
  newStrategy: string;
  /** Specific steps to add/remove/modify in the re-plan. */
  planAdjustments: PlanAdjustment[];
  /** Human-readable summary of the reflection. */
  summary: string;
}

export interface PlanAdjustment {
  action: "add" | "remove" | "replace";
  /** The step to act on (for remove/replace). */
  targetStepType?: string;
  /** The new step to insert (for add/replace). */
  newStepType?: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Autonomous loop
// ---------------------------------------------------------------------------

export interface LoopIteration {
  iteration: number;
  plan: ExecutionPlan;
  result: ExecutionResult;
  observation: ExecutionObservation;
  reflection: ReflectionResult;
  durationMs: number;
}

export interface AutonomousLoopResult {
  /** Did the loop converge on a successful result? */
  success: boolean;
  /** Total iterations run (1 = first attempt succeeded). */
  totalIterations: number;
  /** The final execution result (from the last iteration). */
  finalResult: ExecutionResult;
  /** Full history of every iteration for debugging / logging. */
  iterations: LoopIteration[];
  /** If halted, why. */
  haltReason?: "success" | "max_iterations" | "repeated_failure" | "unretryable";
}

export const MAX_LOOP_ITERATIONS = 3;
