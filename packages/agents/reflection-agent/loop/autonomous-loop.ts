import type { ExecutionPlan } from "@repo/planner-agent";
import type { ContextBuilderAdapter } from "@repo/context-builder";
import type { ExecutionResult, OnStreamEvent, EngineMemorySnapshot, RecordStepFn } from "@repo/execution-engine";
import { executePlan } from "@repo/execution-engine";
import { analyzeResult } from "../reflection/analyze-result";
import { buildReflectionPrompt } from "../reflection/build-reflection-prompt";
import { refinePlan } from "./refine-plan";
import type {
  AutonomousLoopResult,
  ExecutionObservation,
  LoopIteration,
  ReflectionResult,
} from "../reflection/reflection.types";
import { MAX_LOOP_ITERATIONS } from "../reflection/reflection.types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AutonomousLoopOptions {
  repo_id: string;
  query: string;
  adapter: ContextBuilderAdapter;
  workspacePath?: string;
  onEvent?: OnStreamEvent;
  previewMode?: boolean;
  /**
   * Static memory snapshot (used only when `getMemorySnapshot` is not provided).
   * Prefer `getMemorySnapshot` in autonomous loops so each pass sees updated session memory.
   */
  memory?: EngineMemorySnapshot;
  /**
   * Called at the start of every execution pass (including the first) to supply fresh memory.
   * When set, overrides `memory` so reflection / patch records from prior iterations are visible.
   */
  getMemorySnapshot?: () => EngineMemorySnapshot | undefined;
  recordStep?: RecordStepFn;
  maxIterations?: number;
  /** Called before each retry with the reflection prompt so callers can inject it. */
  onReflection?: (prompt: string, iteration: number, reflection: ReflectionResult) => void;
}

/**
 * Autonomous execution loop.
 *
 * 1. Execute the plan
 * 2. Observe results
 * 3. Detect failures
 * 4. Reflect and re-plan
 * 5. Retry (up to maxIterations)
 */
export async function runAutonomousLoop(
  initialPlan: ExecutionPlan,
  opts: AutonomousLoopOptions,
): Promise<AutonomousLoopResult> {
  const maxIter = opts.maxIterations ?? MAX_LOOP_ITERATIONS;
  const iterations: LoopIteration[] = [];
  let currentPlan = initialPlan;
  let lastResult: ExecutionResult | undefined;
  let haltReason: AutonomousLoopResult["haltReason"];
  let previousFailureSignatures = new Set<string>();

  for (let i = 0; i < maxIter; i++) {
    const collector = createEventCollector(opts.onEvent);
    const memoryForPass =
      opts.getMemorySnapshot?.() ?? opts.memory;

    const iterStart = Date.now();
    const result = await executePlan(currentPlan, {
      repo_id: opts.repo_id,
      query: opts.query,
      adapter: opts.adapter,
      workspacePath: opts.workspacePath,
      onEvent: collector.handler,
      previewMode: opts.previewMode,
      memory: memoryForPass,
      recordStep: opts.recordStep,
      iteration: i,
    });
    const iterDuration = Date.now() - iterStart;
    lastResult = result;

    const observation = buildObservation(currentPlan, result, collector, iterDuration);
    const reflection = analyzeResult(observation);

    iterations.push({
      iteration: i,
      plan: currentPlan,
      result,
      observation,
      reflection,
      durationMs: iterDuration,
    });

    if (reflection.success) {
      haltReason = "success";
      break;
    }

    if (!reflection.shouldRetry) {
      haltReason = "unretryable";
      break;
    }

    const currentSignature = failureSignature(reflection);
    if (previousFailureSignatures.has(currentSignature)) {
      haltReason = "repeated_failure";
      break;
    }
    previousFailureSignatures.add(currentSignature);

    if (i === maxIter - 1) {
      haltReason = "max_iterations";
      break;
    }

    const reflectionPrompt = buildReflectionPrompt(reflection, observation, i);
    opts.onReflection?.(reflectionPrompt, i, reflection);

    opts.onEvent?.({
      type: "reflection",
      data: {
        iteration: i,
        summary: reflection.summary,
        shouldRetry: reflection.shouldRetry,
        strategy: reflection.newStrategy,
      },
    });

    currentPlan = refinePlan(currentPlan, reflection);

    opts.onEvent?.({
      type: "plan",
      data: {
        stepCount: currentPlan.steps.length,
        steps: currentPlan.steps.map((s) => ({ id: s.id, type: s.type })),
      },
    });
  }

  return {
    success: haltReason === "success",
    totalIterations: iterations.length,
    finalResult: lastResult!,
    iterations,
    haltReason,
  };
}

// ---------------------------------------------------------------------------
// Event collector — captures specific events for observation
// ---------------------------------------------------------------------------

interface EventCollector {
  handler: OnStreamEvent;
  errors: string[];
  validation?: { valid: boolean; errors?: string[] };
  patchGenerated: boolean;
  patchValid: boolean;
  filesChanged: string[];
}

function createEventCollector(passthrough?: OnStreamEvent): EventCollector {
  const collector: EventCollector = {
    errors: [],
    patchGenerated: false,
    patchValid: true,
    filesChanged: [],
    handler: () => {},
  };

  collector.handler = (event) => {
    switch (event.type) {
      case "error":
        collector.errors.push(event.data.message);
        break;
      case "patch:generated":
        collector.patchGenerated = true;
        break;
      case "patch:validated":
        collector.validation = event.data;
        if (!event.data.valid) collector.patchValid = false;
        break;
      case "patch:preview":
        collector.patchGenerated = true;
        collector.filesChanged = event.data.diffs.map((d) => d.file);
        break;
      case "patch:applied":
        if (!event.data.success) collector.patchValid = false;
        break;
      case "reflection":
        break;
      default:
        break;
    }
    passthrough?.(event);
  };

  return collector;
}

// ---------------------------------------------------------------------------
// Observation builder
// ---------------------------------------------------------------------------

function buildObservation(
  plan: ExecutionPlan,
  result: ExecutionResult,
  collector: EventCollector,
  durationMs: number,
): ExecutionObservation {
  return {
    plan,
    result,
    capturedErrors: collector.errors,
    capturedValidation: collector.validation,
    patchGenerated: collector.patchGenerated,
    patchValid: collector.patchValid,
    filesChanged: collector.filesChanged,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// Failure signature — for detecting repeated identical failures
// ---------------------------------------------------------------------------

function failureSignature(reflection: ReflectionResult): string {
  return reflection.failures
    .map((f) => `${f.kind}:${f.message}`)
    .sort()
    .join("|");
}
