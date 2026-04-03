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
  "model:route:fallback",
  "model:route:outcome",
  "model:tier:denied",
  "result:emitted",

  // A.1 request lifecycle (emitted by workflowLog in this repo)
  "request:start",
  "request:resume",
  "request:complete",

  // D.21 quality feedback
  "feedback:received",

  // E.22 multimodal attachments
  "multimodal:attachments:received",

  // E.23 media upload / resolution
  "multimodal:media:uploaded",
  "multimodal:media:resolved",

  // E.26 browser runner (WS6)
  "browser:session:start",
  "browser:navigate",
  "browser:screenshot",
  "browser:session:end",
  "browser:policy:denied",

  // E.27 validation recipe (WS6: browser:assert:pass|fail)
  "browser:assert:pass",
  "browser:assert:fail",

  // F.30 entitlement resolution (WS1)
  "entitlement:checked",
  "entitlement:denied",

  // F.31 usage event emission (WS2)
  "usage:event:emitted",
  "usage:event:skipped",

  // F.32 usage aggregation job (WS2)
  "usage:aggregate:complete",

  // F.33 quota checks (WS2)
  "quota:check",

  // G.36 editor inline completion
  "editor:inline-complete:requested",
  "editor:inline-complete:completed",

  // G.37 editor inline edit
  "editor:inline-edit:requested",
  "editor:inline-edit:completed",

  // G.38 git commit/PR assistant
  "git:assistant:requested",
  "git:assistant:completed",

  // G.39 testing assistant
  "testing:assistant:requested",
  "testing:assistant:completed",

  // G.40 privacy boundary policy layer
  "privacy:path:blocked",

  // H.43 SLO alerting
  "slo:check:ok",
  "slo:alert:fired",

  // H.44 router shadow traffic + staged rollout
  "router:shadow:compare",
  "router:policy:rollout",

  // F.34 Stripe billing webhook ingestion (WS2)
  "billing:webhook:received",
  "billing:webhook:applied",
  "billing:webhook:ignored",
  "billing:webhook:duplicate",

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
    const stagesWithLatency: ReadonlySet<string> = new Set(["request:complete", "model:route:outcome"]);
    if (val.workflow_stage === "request:complete") {
      if (val.latency_ms === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["latency_ms"],
          message: "latency_ms is required for request:complete",
        });
      }
    } else if (val.latency_ms !== undefined && !stagesWithLatency.has(val.workflow_stage)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["latency_ms"],
        message: "latency_ms is only allowed for request:complete or model:route:outcome",
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

