/**
 * G.37 — Inline in-file edit service.
 *
 * Given a file's full content + an instruction (and optionally a selection range),
 * returns the full modified file content suitable for the desktop's PendingEdit →
 * MonacoDiffEditor Accept/Reject flow.
 *
 * Design:
 *   - Uses OpenAI chat completions with a system prompt that returns ONLY the
 *     complete modified file — no markdown fences, no explanations.
 *   - Selection-based edits send the selection + surrounding context; the model
 *     returns the full file with the selection region modified.
 *   - max_tokens capped at 4096 for MVP (reasonable for single-file edits).
 *   - Errors are returned as structured { error } responses — never swallowed
 *     (unlike inline completion, edits are user-initiated and should show errors).
 *
 * Kill-switch: VIPER_INLINE_EDIT_ENABLED=1 — checked by the route.
 */

import OpenAI from "openai";
import { workflowLog } from "../services/assistant.service.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_FILE_CONTENT_CHARS = 32_000;
export const MAX_INSTRUCTION_CHARS = 2_000;
export const MAX_EDIT_TOKENS = 4_096;
export const EDIT_TIMEOUT_MS = 30_000;
export const EDIT_TEMPERATURE = 0.2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InlineEditSelection {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface InlineEditRequest {
  workspacePath: string;
  filePath: string;
  languageId: string;
  instruction: string;
  fileContent: string;
  selection?: InlineEditSelection;
  selectionText?: string;
}

export interface InlineEditResult {
  modifiedFileContent: string;
}

// ---------------------------------------------------------------------------
// Kill-switch
// ---------------------------------------------------------------------------

export function isInlineEditEnabled(): boolean {
  const v = process.env["VIPER_INLINE_EDIT_ENABLED"] ?? "";
  return v === "1" || v.toLowerCase() === "true";
}

// ---------------------------------------------------------------------------
// OpenAI client
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

export function buildEditPrompt(req: InlineEditRequest): string {
  const truncatedContent = req.fileContent.slice(0, MAX_FILE_CONTENT_CHARS);
  const lang = req.languageId || "code";

  let selectionSection = "";
  if (req.selection && req.selectionText) {
    selectionSection = `
The user has selected the following region (lines ${req.selection.startLine}–${req.selection.endLine}):
\`\`\`
${req.selectionText}
\`\`\`
Focus your changes on this selected region. You may adjust surrounding code if necessary for correctness, but minimize changes outside the selection.`;
  }

  return `You are a code editor assistant. Apply the user's instruction to the ${lang} file below.
Return ONLY the complete modified file content — no explanations, no markdown fences wrapping the whole output, no line numbers.
If the instruction is unclear or impossible, return the original file unchanged.
${selectionSection}

--- FILE: ${req.filePath} ---
${truncatedContent}
--- END FILE ---

Instruction: ${req.instruction}`;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export async function generateInlineEdit(
  req: InlineEditRequest,
): Promise<InlineEditResult> {
  const billingIdentity = {
    request_id: `inline-edit-${Date.now()}`,
    workspace_id: req.workspacePath,
    conversation_id: null,
  };

  workflowLog("editor:inline-edit:requested", billingIdentity, {
    filePath: req.filePath,
    languageId: req.languageId,
    hasSelection: !!req.selectionText,
    instructionLen: req.instruction.length,
    fileLen: req.fileContent.length,
  });

  const prompt = buildEditPrompt(req);
  const client = getOpenAIClient();
  const model = process.env["VIPER_INLINE_EDIT_MODEL"] ?? "gpt-4o";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EDIT_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_EDIT_TOKENS,
        temperature: EDIT_TEMPERATURE,
      },
      { signal: controller.signal },
    );

    let text = response.choices[0]?.message?.content ?? "";

    // Strip markdown fences if the model wraps the output despite instructions
    text = stripMarkdownFences(text);

    workflowLog("editor:inline-edit:completed", billingIdentity, {
      filePath: req.filePath,
      resultLen: text.length,
      unchanged: text === req.fileContent,
    });

    return { modifiedFileContent: text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strip leading/trailing markdown code fences if the model adds them.
 * e.g. ```typescript\n...\n``` → inner content only.
 */
export function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fenceStart = /^```[a-zA-Z]*\n/;
  const fenceEnd = /\n```$/;
  if (fenceStart.test(trimmed) && fenceEnd.test(trimmed)) {
    return trimmed.replace(fenceStart, "").replace(fenceEnd, "");
  }
  return text;
}
