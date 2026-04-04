/**
 * G.39 — Testing assistant routes.
 *
 * POST /testing/suggest-commands
 *   Maps changed file paths to plausible test commands.
 *   Response: { commands: Array<{ cwd?, shell, rationale }> }
 *
 * POST /testing/triage-failure
 *   Analyzes pasted test runner output and returns structured triage.
 *   Response: { summary, bullets, suggestedCommands }
 *
 * Kill-switch: VIPER_TEST_ASSISTANT_ENABLED=1 required; when off → 404.
 * Auth: entitlementsPreHandler on both routes.
 */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { entitlementsPreHandler } from "../middleware/entitlements.middleware.js";
import {
  isTestAssistantEnabled,
  suggestTestCommands,
  triageFailure,
  MAX_CHANGED_FILES,
  MAX_RUNNER_OUTPUT_CHARS,
} from "../lib/test-assistant.service.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const SuggestCommandsSchema = z.object({
  workspacePath: z.string().min(1),
  changedFiles: z
    .array(z.string().max(512))
    .max(MAX_CHANGED_FILES, `Too many files (max ${MAX_CHANGED_FILES})`)
    .min(1, "changedFiles must not be empty"),
  packageHint: z.enum(["backend", "database", "desktop", "auto"]).optional(),
});

export const TriageSchema = z.object({
  workspacePath: z.string().min(1),
  runnerOutput: z
    .string()
    .min(1, "runnerOutput must not be empty")
    .max(MAX_RUNNER_OUTPUT_CHARS * 2, "runnerOutput too long"),
  runner: z.enum(["vitest", "jest", "unknown"]).optional(),
});

export type SuggestCommandsInput = z.infer<typeof SuggestCommandsSchema>;
export type TriageInput = z.infer<typeof TriageSchema>;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function postSuggestCommands(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isTestAssistantEnabled()) {
    return reply.status(404).send({ error: "Not found" });
  }

  const parsed = SuggestCommandsSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Invalid request",
      issues: parsed.error.issues.map((i) => i.message),
    });
  }

  try {
    const result = await suggestTestCommands(parsed.data);
    return reply.status(200).send(result);
  } catch (err) {
    request.log.error({ err }, "Test suggest error");
    return reply.status(500).send({
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
}

export async function postTriageFailure(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isTestAssistantEnabled()) {
    return reply.status(404).send({ error: "Not found" });
  }

  const parsed = TriageSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Invalid request",
      issues: parsed.error.issues.map((i) => i.message),
    });
  }

  try {
    const result = await triageFailure(parsed.data);
    return reply.status(200).send(result);
  } catch (err) {
    request.log.error({ err }, "Triage error");
    return reply.status(500).send({
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function testingRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: unknown }>("/testing/suggest-commands", {
    preHandler: entitlementsPreHandler,
    schema: {
      body: {
        type: "object",
        required: ["workspacePath", "changedFiles"],
        properties: {
          workspacePath: { type: "string" },
          changedFiles: { type: "array", items: { type: "string" } },
          packageHint: {
            type: "string",
            enum: ["backend", "database", "desktop", "auto"],
          },
        },
      },
    },
  }, postSuggestCommands);

  app.post<{ Body: unknown }>("/testing/triage-failure", {
    preHandler: entitlementsPreHandler,
    schema: {
      body: {
        type: "object",
        required: ["workspacePath", "runnerOutput"],
        properties: {
          workspacePath: { type: "string" },
          runnerOutput: { type: "string" },
          runner: { type: "string", enum: ["vitest", "jest", "unknown"] },
        },
      },
    },
  }, postTriageFailure);
}
