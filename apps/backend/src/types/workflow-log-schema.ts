import { z } from "zod";

export const VALID_WORKFLOW_STAGES = [
  // Roadmap (Required Backend Debug Logging Contract — section 7)
  "intent:start",
  "intent:complete",
  "route:direct-llm",
  "route:agentic",
  "analysis:warmup:start",
  "analysis:warmup:complete",
  "analysis:warmup:error",
  "context-primer:start",
  "context-primer:complete",
  "context-primer:error",
  "retrieval:confidence:computed",
  "workflow:gate",
  "agentic-loop:start",
  "agentic-loop:complete",
  "validation:started",
  "validation:passed",
  "validation:failed",
  "auto-repair:attempt",
  "auto-repair:result",
  "mode:tool:blocked",
  "model:route:selected",
  "result:emitted",

  // A.1 request lifecycle (emitted by workflowLog in this repo)
  "request:start",
  "request:resume",
  "request:complete",

  // Existing edit gate / analysis background stages (emitted by workflowLog in this repo)
  "edit-gate:blocked",
  "edit-gate:passed",
  "analysis:background:complete",
  "analysis:background:error",
] as const satisfies readonly [string, ...string[]];

const WorkflowStageEnum = z.enum(VALID_WORKFLOW_STAGES);

export const WorkflowLogEventSchema = z
  .object({
    workflow_stage: WorkflowStageEnum,

    // Request identity contract (A.1)
    request_id: z.string().min(1),
    workspace_id: z.string().min(1),
    conversation_id: z.string().nullable(),

    // Optional fields (available after certain orchestration steps)
    mode: z.string().optional().nullable(),
    model_route: z.string().optional().nullable(),
    intent: z.string().optional(),

    // Only present on request:complete (enforced below)
    latency_ms: z.number().finite().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    // `latency_ms` only belongs to request lifecycle completion logs.
    if (val.workflow_stage === "request:complete") {
      if (val.latency_ms === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["latency_ms"],
          message: "latency_ms is required for request:complete",
        });
      }
    } else if (val.latency_ms !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["latency_ms"],
        message: "latency_ms is only allowed for request:complete",
      });
    }

    // Stronger contract for stages where intent is expected in this repo.
    if (val.workflow_stage === "intent:complete") {
      if (!val.intent || val.intent.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intent"],
          message: "intent is required for intent:complete",
        });
      }
    }

    if (val.workflow_stage === "route:direct-llm" || val.workflow_stage === "route:agentic") {
      if (!val.intent || val.intent.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intent"],
          message: "intent is required for route:* stages",
        });
      }
    }
  });

export type WorkflowLogEvent = z.infer<typeof WorkflowLogEventSchema>;

export function validateWorkflowLog(
  stage: string,
  payload: Record<string, unknown>,
):
  | { valid: true }
  | {
      valid: false;
      issues: string[];
    } {
  const toValidate: Record<string, unknown> = {
    ...payload,
    workflow_stage: stage,
  };

  const result = WorkflowLogEventSchema.safeParse(toValidate);
  if (result.success) return { valid: true };

  return {
    valid: false,
    issues: result.error.issues.map((i) => {
      const path = i.path.length ? i.path.join(".") : "(root)";
      return `${path}: ${i.message}`;
    }),
  };
}

