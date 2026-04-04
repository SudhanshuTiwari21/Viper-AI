import type { FastifyReply, FastifyRequest } from "fastify";
import { workflowRuntimeConfig } from "../config/workflow-flags.js";

/**
 * GET /debug/workflow-policy — JSON snapshot of assistant orchestration policy (no secrets).
 *
 * Production safety: hidden unless `VIPER_EXPOSE_WORKFLOW_DEBUG === "1"`.
 * Otherwise responds with **404** (route appears absent) so public deployments do not leak
 * warmup/edit-gate/model settings by default. This gate is checked per request from `process.env`
 * (independent of the eager `workflowRuntimeConfig` snapshot).
 */
export async function getWorkflowPolicy(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (process.env.VIPER_EXPOSE_WORKFLOW_DEBUG !== "1") {
    await reply.code(404).send();
    return;
  }

  await reply.type("application/json").send({
    ...workflowRuntimeConfig,
    meta: {
      ts: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV ?? "unknown",
    },
  });
}
