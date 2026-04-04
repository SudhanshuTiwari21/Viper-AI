/**
 * G.36 — Inline completion service.
 *
 * Generates a single ghost-text completion for the Monaco editor using OpenAI.
 *
 * Design:
 *   - Reuses the shared `getOpenAIClient()` helper (defined here alongside
 *     assistant.service.ts's private copy — see note below).
 *   - Uses a FIM-style prompt: text before cursor is suffix context; text
 *     after cursor is "what comes next" context.
 *   - Low latency settings: small max_tokens (120), temperature 0.2, stop at
 *     newline for single-line mode.
 *   - Input capped server-side (MAX_BEFORE / MAX_AFTER chars) to prevent
 *     prompt bloat on large files.
 *   - Returns empty string on any error (never throws to the route handler).
 *
 * Note on shared OpenAI client:
 *   assistant.service.ts has a private `getOpenAIClient()`. To avoid a second
 *   module-level OpenAI dependency, we define a local version here that reads
 *   the same OPENAI_API_KEY. Both are ~3 lines; duplicating is cheaper than
 *   refactoring the internal helper out of the 2k-line assistant.service.ts.
 *
 * Kill-switch:
 *   VIPER_INLINE_COMPLETION_ENABLED=1 — checked by the route, not here.
 *
 * Observability:
 *   workflowLog("editor:inline-complete:requested" / "…:completed") emitted
 *   when DEBUG_WORKFLOW is on — using null identity (no HTTP request context).
 */

import OpenAI from "openai";
import { workflowLog } from "../services/assistant.service.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max chars of pre-cursor context sent to the model. */
export const MAX_BEFORE_CHARS = 4_096;

/** Max chars of post-cursor context sent to the model. */
export const MAX_AFTER_CHARS = 512;

/** Max tokens in the completion response. */
export const MAX_COMPLETION_TOKENS = 120;

/** Hard timeout for the OpenAI call in milliseconds. */
export const COMPLETION_TIMEOUT_MS = 4_000;

/** Temperature for completions — low for deterministic code. */
export const COMPLETION_TEMPERATURE = 0.2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InlineCompletionRequest {
  workspacePath: string;
  filePath: string;
  languageId: string;
  textBeforeCursor: string;
  textAfterCursor?: string;
  cursorLine: number;
  cursorColumn: number;
}

export interface InlineCompletionResult {
  /** The suggested text to insert at the cursor. Empty string = no suggestion. */
  text: string;
}

// ---------------------------------------------------------------------------
// Kill-switch
// ---------------------------------------------------------------------------

export function isInlineCompletionEnabled(): boolean {
  const v = process.env["VIPER_INLINE_COMPLETION_ENABLED"] ?? "";
  return v === "1" || v.toLowerCase() === "true";
}

// ---------------------------------------------------------------------------
// OpenAI client (local copy — same pattern as assistant.service.ts)
// ---------------------------------------------------------------------------

function getOpenAIClient(): OpenAI {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

/**
 * Build a minimal FIM-style prompt that the model can complete inline.
 * We use a chat completion endpoint with a small system context so we can
 * reuse the shared OpenAI client without a separate Completions endpoint.
 */
export function buildCompletionPrompt(
  languageId: string,
  beforeCursor: string,
  afterCursor: string,
): string {
  // Truncate aggressively to stay within budget
  const before = beforeCursor.slice(-MAX_BEFORE_CHARS);
  const after = afterCursor.slice(0, MAX_AFTER_CHARS);

  const lang = languageId || "code";
  const afterSection = after.length > 0 ? `\n\n// Code after cursor:\n${after}` : "";

  return `You are an inline code completion assistant. Complete the ${lang} code at the cursor position.
Return ONLY the text to insert at the cursor — no explanations, no markdown fences, no extra lines.
If unsure, return an empty string.

// Code before cursor:
${before}${afterSection}

// Complete from here:`;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Generate a single inline completion suggestion.
 * Returns `{ text: "" }` on any error or timeout (never throws).
 */
export async function generateInlineCompletion(
  req: InlineCompletionRequest,
): Promise<InlineCompletionResult> {
  // Safety: reject empty prompt
  const before = req.textBeforeCursor?.trim() ?? "";
  if (before.length === 0) return { text: "" };

  const after = req.textAfterCursor ?? "";

  const billingIdentity = {
    request_id: `inline-${Date.now()}`,
    workspace_id: req.workspacePath,
    conversation_id: null,
  };

  workflowLog("editor:inline-complete:requested", billingIdentity, {
    languageId: req.languageId,
    filePath: req.filePath,
    beforeLen: before.length,
  });

  const prompt = buildCompletionPrompt(req.languageId, before, after);

  try {
    const client = getOpenAIClient();

    const model = process.env["VIPER_INLINE_COMPLETION_MODEL"] ?? "gpt-4o-mini";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), COMPLETION_TIMEOUT_MS);

    let text = "";
    try {
      const response = await client.chat.completions.create(
        {
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: MAX_COMPLETION_TOKENS,
          temperature: COMPLETION_TEMPERATURE,
          stop: ["\n\n", "// Code", "```"],
        },
        { signal: controller.signal },
      );

      text = response.choices[0]?.message?.content?.trim() ?? "";
    } finally {
      clearTimeout(timer);
    }

    workflowLog("editor:inline-complete:completed", billingIdentity, {
      languageId: req.languageId,
      resultLen: text.length,
      isEmpty: text.length === 0,
    });

    return { text };
  } catch (err) {
    // Silently swallow all errors — inline completion should never surface
    workflowLog("editor:inline-complete:completed", billingIdentity, {
      languageId: req.languageId,
      resultLen: 0,
      isEmpty: true,
      error: err instanceof Error ? err.message : String(err),
    });
    return { text: "" };
  }
}
