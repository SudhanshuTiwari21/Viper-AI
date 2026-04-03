/**
 * G.36 + G.37 — Editor feature routes.
 *
 * POST /editor/inline-complete  (G.36)
 *   Ghost-text completion for Monaco.
 *
 * POST /editor/inline-edit  (G.37)
 *   AI-powered in-file edit: takes instruction + file content (+ optional
 *   selection) and returns the full modified file content, which the desktop
 *   feeds into the existing PendingEdit → MonacoDiffEditor Accept/Reject flow.
 *
 * Kill-switches:
 *   VIPER_INLINE_COMPLETION_ENABLED=1 — inline-complete; off → 404.
 *   VIPER_INLINE_EDIT_ENABLED=1       — inline-edit; off → 404.
 *
 * Auth / isolation:
 *   entitlementsPreHandler on both routes (workspace-scoped).
 */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { entitlementsPreHandler } from "../middleware/entitlements.middleware.js";
import {
  isInlineCompletionEnabled,
  generateInlineCompletion,
  MAX_BEFORE_CHARS,
  MAX_AFTER_CHARS,
} from "../lib/inline-completion.service.js";
import {
  isInlineEditEnabled,
  generateInlineEdit,
  MAX_FILE_CONTENT_CHARS,
  MAX_INSTRUCTION_CHARS,
} from "../lib/inline-edit.service.js";
import { isPrivacyAllowed } from "@repo/workspace-tools";

// ---------------------------------------------------------------------------
// Zod schema (authoritative)
// ---------------------------------------------------------------------------

export const InlineCompleteRequestSchema = z.object({
  workspacePath: z.string().min(1),
  filePath: z.string().min(1),
  languageId: z.string().min(1).max(64),
  textBeforeCursor: z.string().max(MAX_BEFORE_CHARS * 2, "textBeforeCursor too long"),
  textAfterCursor: z.string().max(MAX_AFTER_CHARS * 2, "textAfterCursor too long").optional(),
  cursorLine: z.number().int().min(1),
  cursorColumn: z.number().int().min(1),
});

export type InlineCompleteRequest = z.infer<typeof InlineCompleteRequestSchema>;

// ---------------------------------------------------------------------------
// Route handler (separated for testability)
// ---------------------------------------------------------------------------

export async function postInlineComplete(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isInlineCompletionEnabled()) {
    return reply.status(404).send({ error: "Not found" });
  }

  const parsed = InlineCompleteRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Invalid request",
      issues: parsed.error.issues.map((i) => i.message),
    });
  }

  // G.40: privacy gate — return empty completion for blocked paths (silent, no toast spam)
  const privacyCheck = await isPrivacyAllowed(parsed.data.workspacePath, parsed.data.filePath);
  if (!privacyCheck.allowed) {
    request.log.warn({ pathHash: privacyCheck.pathHash, rule: privacyCheck.blockedBy }, "privacy:path:blocked inline-complete");
    return reply.status(200).send({ text: "" });
  }

  const result = await generateInlineCompletion(parsed.data);
  return reply.status(200).send({ text: result.text });
}

// ---------------------------------------------------------------------------
// G.37: Inline edit schemas + handler
// ---------------------------------------------------------------------------

const InlineEditSelectionSchema = z.object({
  startLine: z.number().int().min(1),
  startColumn: z.number().int().min(1),
  endLine: z.number().int().min(1),
  endColumn: z.number().int().min(1),
});

export const InlineEditRequestSchema = z.object({
  workspacePath: z.string().min(1),
  filePath: z.string().min(1),
  languageId: z.string().min(1).max(64),
  instruction: z.string().min(1).max(MAX_INSTRUCTION_CHARS, "instruction too long"),
  fileContent: z.string().max(MAX_FILE_CONTENT_CHARS * 2, "fileContent too long"),
  selection: InlineEditSelectionSchema.optional(),
  selectionText: z.string().max(MAX_FILE_CONTENT_CHARS, "selectionText too long").optional(),
});

export type InlineEditRequest = z.infer<typeof InlineEditRequestSchema>;

export async function postInlineEdit(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isInlineEditEnabled()) {
    return reply.status(404).send({ error: "Not found" });
  }

  const parsed = InlineEditRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Invalid request",
      issues: parsed.error.issues.map((i) => i.message),
    });
  }

  // G.40: privacy gate — block edits to sensitive file paths
  const privacyCheck = await isPrivacyAllowed(parsed.data.workspacePath, parsed.data.filePath);
  if (!privacyCheck.allowed) {
    request.log.warn({ pathHash: privacyCheck.pathHash, rule: privacyCheck.blockedBy }, "privacy:path:blocked inline-edit");
    return reply.status(403).send({ error: "Privacy policy denied access to this file" });
  }

  try {
    const result = await generateInlineEdit(parsed.data);
    return reply.status(200).send({ modifiedFileContent: result.modifiedFileContent });
  } catch (err) {
    request.log.error({ err }, "Inline edit generation error");
    const msg = err instanceof Error ? err.message : "Internal error";
    return reply.status(500).send({ error: msg });
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function editorRoutes(app: FastifyInstance): Promise<void> {
  // G.36: inline completion
  app.post<{ Body: unknown }>("/editor/inline-complete", {
    preHandler: entitlementsPreHandler,
    schema: {
      body: {
        type: "object",
        required: ["workspacePath", "filePath", "languageId", "textBeforeCursor", "cursorLine", "cursorColumn"],
        properties: {
          workspacePath: { type: "string" },
          filePath: { type: "string" },
          languageId: { type: "string" },
          textBeforeCursor: { type: "string" },
          textAfterCursor: { type: "string" },
          cursorLine: { type: "integer", minimum: 1 },
          cursorColumn: { type: "integer", minimum: 1 },
        },
      },
    },
  }, postInlineComplete);

  // G.37: inline edit
  app.post<{ Body: unknown }>("/editor/inline-edit", {
    preHandler: entitlementsPreHandler,
    schema: {
      body: {
        type: "object",
        required: ["workspacePath", "filePath", "languageId", "instruction", "fileContent"],
        properties: {
          workspacePath: { type: "string" },
          filePath: { type: "string" },
          languageId: { type: "string" },
          instruction: { type: "string" },
          fileContent: { type: "string" },
          selection: {
            type: "object",
            properties: {
              startLine: { type: "integer", minimum: 1 },
              startColumn: { type: "integer", minimum: 1 },
              endLine: { type: "integer", minimum: 1 },
              endColumn: { type: "integer", minimum: 1 },
            },
          },
          selectionText: { type: "string" },
        },
      },
    },
  }, postInlineEdit);
}
