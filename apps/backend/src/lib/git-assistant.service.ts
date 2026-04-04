/**
 * G.38 — Git commit/PR assistant service.
 *
 * Generates AI commit messages and PR descriptions from a staged diff.
 *
 * Design:
 *   - Two modes controlled by a `mode` field: "commit" or "pr".
 *   - Commit mode: returns { subject, body? } following the user's preferred
 *     style ("conventional" or "short").
 *   - PR mode: returns { title, body } markdown suitable for GitHub/GitLab.
 *   - stagedDiff truncated server-side to MAX_DIFF_CHARS before being sent
 *     to the model (client-side capping is advisory; server enforces).
 *   - 25s AbortController timeout.
 *   - Errors propagated (user-initiated action).
 *
 * Kill-switch: VIPER_COMMIT_ASSISTANT_ENABLED=1 — checked by the route.
 */

import OpenAI from "openai";
import { workflowLog } from "../services/assistant.service.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum bytes of staged diff forwarded to the model. */
export const MAX_DIFF_CHARS = 32_000;
export const COMMIT_TIMEOUT_MS = 25_000;
export const COMMIT_TEMPERATURE = 0.3;
export const COMMIT_MAX_TOKENS = 512;
export const PR_MAX_TOKENS = 1_024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommitStyle = "conventional" | "short";

export interface CommitSuggestionRequest {
  workspacePath: string;
  branch?: string;
  stagedDiff: string;
  style?: CommitStyle;
}

export interface CommitSuggestionResult {
  subject: string;
  body?: string;
}

export interface PrSuggestionRequest {
  workspacePath: string;
  branch?: string;
  stagedDiff: string;
}

export interface PrSuggestionResult {
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Kill-switch
// ---------------------------------------------------------------------------

export function isCommitAssistantEnabled(): boolean {
  const v = process.env["VIPER_COMMIT_ASSISTANT_ENABLED"] ?? "";
  return v === "1" || v.toLowerCase() === "true";
}

// ---------------------------------------------------------------------------
// OpenAI client
// ---------------------------------------------------------------------------

function getOpenAIClient(): OpenAI {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  return new OpenAI({ apiKey });
}

function getModel(): string {
  return process.env["VIPER_COMMIT_ASSISTANT_MODEL"] ?? "gpt-4o-mini";
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

export function buildCommitPrompt(
  diff: string,
  style: CommitStyle,
  branch?: string,
): string {
  const truncated = diff.slice(0, MAX_DIFF_CHARS);
  const branchHint = branch ? `\nCurrent branch: ${branch}` : "";

  const styleGuide =
    style === "conventional"
      ? `Follow Conventional Commits format: <type>(<scope>): <short description>
Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build.
Subject line max 72 chars. Body: wrap at 72 chars, explain WHY not WHAT.`
      : `Write a concise subject line (≤72 chars). Optionally add a short body if the change warrants explanation.`;

  return `You are a senior engineer writing git commit messages.${branchHint}

${styleGuide}

Return a JSON object with exactly these fields:
  { "subject": "<subject line>", "body": "<optional body paragraphs or empty string>" }

Do NOT include markdown fences. Return only the raw JSON object.

--- STAGED DIFF ---
${truncated}
--- END DIFF ---`;
}

export function buildPrPrompt(diff: string, branch?: string): string {
  const truncated = diff.slice(0, MAX_DIFF_CHARS);
  const branchHint = branch ? `\nBranch: ${branch}` : "";

  return `You are a senior engineer writing a GitHub Pull Request description.${branchHint}

Produce a clear, professional PR description with these sections:
## Summary
(2-4 bullet points describing WHAT changed and WHY)

## Changes
(Key technical changes, grouped logically)

## Test plan
(How to verify the changes)

Return a JSON object:
{ "title": "<PR title, ≤72 chars>", "body": "<full markdown body>" }

Do NOT include markdown fences around the JSON. Return only the raw JSON object.

--- STAGED DIFF ---
${truncated}
--- END DIFF ---`;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export async function suggestCommitMessage(
  req: CommitSuggestionRequest,
): Promise<CommitSuggestionResult> {
  const identity = {
    request_id: `git-commit-${Date.now()}`,
    workspace_id: req.workspacePath,
    conversation_id: null,
  };

  workflowLog("git:assistant:requested", identity, {
    mode: "commit",
    style: req.style ?? "conventional",
    diffLen: req.stagedDiff.length,
    branch: req.branch,
  });

  const style: CommitStyle = req.style ?? "conventional";
  const prompt = buildCommitPrompt(req.stagedDiff, style, req.branch);
  const client = getOpenAIClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMMIT_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: getModel(),
        messages: [{ role: "user", content: prompt }],
        max_tokens: COMMIT_MAX_TOKENS,
        temperature: COMMIT_TEMPERATURE,
        response_format: { type: "json_object" },
      },
      { signal: controller.signal },
    );

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { subject?: string; body?: string };
    const subject = (parsed.subject ?? "").trim();
    const body = (parsed.body ?? "").trim() || undefined;

    workflowLog("git:assistant:completed", identity, {
      mode: "commit",
      subjectLen: subject.length,
      hasBody: !!body,
    });

    return { subject: subject || "chore: update", body };
  } finally {
    clearTimeout(timer);
  }
}

export async function suggestPrBody(
  req: PrSuggestionRequest,
): Promise<PrSuggestionResult> {
  const identity = {
    request_id: `git-pr-${Date.now()}`,
    workspace_id: req.workspacePath,
    conversation_id: null,
  };

  workflowLog("git:assistant:requested", identity, {
    mode: "pr",
    diffLen: req.stagedDiff.length,
    branch: req.branch,
  });

  const prompt = buildPrPrompt(req.stagedDiff, req.branch);
  const client = getOpenAIClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMMIT_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: getModel(),
        messages: [{ role: "user", content: prompt }],
        max_tokens: PR_MAX_TOKENS,
        temperature: COMMIT_TEMPERATURE,
        response_format: { type: "json_object" },
      },
      { signal: controller.signal },
    );

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { title?: string; body?: string };
    const title = (parsed.title ?? "").trim();
    const body = (parsed.body ?? "").trim();

    workflowLog("git:assistant:completed", identity, {
      mode: "pr",
      titleLen: title.length,
      bodyLen: body.length,
    });

    return { title: title || "chore: update", body };
  } finally {
    clearTimeout(timer);
  }
}
