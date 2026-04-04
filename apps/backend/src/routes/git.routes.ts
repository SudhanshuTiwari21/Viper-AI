/**
 * G.38 — Git assistant routes.
 *
 * POST /git/suggest-commit
 *   Given a staged diff, returns an AI-generated commit message.
 *   Response: { subject: string, body?: string }
 *
 * POST /git/suggest-pr-body
 *   Given a staged diff, returns an AI-generated PR title + markdown body.
 *   Response: { title: string, body: string }
 *
 * Kill-switch: VIPER_COMMIT_ASSISTANT_ENABLED=1 required; when off → 404
 * (hidden endpoint pattern, consistent with G.36/G.37).
 *
 * Auth / isolation:
 *   entitlementsPreHandler on both routes. When VIPER_ENTITLEMENTS_ENFORCE=1
 *   only workspace members get responses; when off → dev-trust (same as chat).
 */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { entitlementsPreHandler } from "../middleware/entitlements.middleware.js";
import {
  isCommitAssistantEnabled,
  suggestCommitMessage,
  suggestPrBody,
  MAX_DIFF_CHARS,
} from "../lib/git-assistant.service.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const SuggestCommitRequestSchema = z.object({
  workspacePath: z.string().min(1),
  branch: z.string().max(256).optional(),
  stagedDiff: z.string().max(MAX_DIFF_CHARS * 2, "stagedDiff too long"),
  style: z.enum(["conventional", "short"]).optional(),
});

export const SuggestPrRequestSchema = z.object({
  workspacePath: z.string().min(1),
  branch: z.string().max(256).optional(),
  stagedDiff: z.string().max(MAX_DIFF_CHARS * 2, "stagedDiff too long"),
});

export type SuggestCommitRequest = z.infer<typeof SuggestCommitRequestSchema>;
export type SuggestPrRequest = z.infer<typeof SuggestPrRequestSchema>;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function postSuggestCommit(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isCommitAssistantEnabled()) {
    return reply.status(404).send({ error: "Not found" });
  }

  const parsed = SuggestCommitRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Invalid request",
      issues: parsed.error.issues.map((i) => i.message),
    });
  }

  try {
    const result = await suggestCommitMessage(parsed.data);
    return reply.status(200).send(result);
  } catch (err) {
    request.log.error({ err }, "Commit assistant error");
    const msg = err instanceof Error ? err.message : "Internal error";
    return reply.status(500).send({ error: msg });
  }
}

export async function postSuggestPr(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isCommitAssistantEnabled()) {
    return reply.status(404).send({ error: "Not found" });
  }

  const parsed = SuggestPrRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Invalid request",
      issues: parsed.error.issues.map((i) => i.message),
    });
  }

  try {
    const result = await suggestPrBody(parsed.data);
    return reply.status(200).send(result);
  } catch (err) {
    request.log.error({ err }, "PR assistant error");
    const msg = err instanceof Error ? err.message : "Internal error";
    return reply.status(500).send({ error: msg });
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function gitRoutes(app: FastifyInstance): Promise<void> {
  const bodySchema = (extraProps: Record<string, unknown>) => ({
    type: "object",
    required: ["workspacePath", "stagedDiff"],
    properties: {
      workspacePath: { type: "string" },
      branch: { type: "string" },
      stagedDiff: { type: "string" },
      ...extraProps,
    },
  });

  app.post<{ Body: unknown }>("/git/suggest-commit", {
    preHandler: entitlementsPreHandler,
    schema: {
      body: bodySchema({ style: { type: "string", enum: ["conventional", "short"] } }),
    },
  }, postSuggestCommit);

  app.post<{ Body: unknown }>("/git/suggest-pr-body", {
    preHandler: entitlementsPreHandler,
    schema: { body: bodySchema({}) },
  }, postSuggestPr);
}
