/**
 * G.39 — Test targeting and failure triage service.
 *
 * Two functions:
 *
 *   suggestTestCommands(req)
 *     Heuristic + AI: maps changed file paths to candidate test commands.
 *     Heuristics run first (fast path); AI fills gaps for non-obvious mappings.
 *     Returns 1–3 commands with cwd and rationale.
 *
 *   triageFailure(req)
 *     Sends truncated test runner output to the model and returns a structured
 *     triage: summary paragraph, bullet points, and suggested follow-up commands.
 *     No auto-patching — analysis only.
 *
 * Kill-switch: VIPER_TEST_ASSISTANT_ENABLED=1 — checked by the route.
 *
 * Heuristic limitations (documented):
 *   - Assumes co-located *.test.ts / *.test.tsx files.
 *   - Does not perform a full dependency graph traversal; only direct path mapping.
 *   - For packages not in the known registry, falls back to "run all tests in package".
 */

import OpenAI from "openai";
import { workflowLog } from "../services/assistant.service.js";
import path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_CHANGED_FILES = 50;
export const MAX_RUNNER_OUTPUT_CHARS = 64_000;
export const TEST_TIMEOUT_MS = 25_000;
export const TEST_TEMPERATURE = 0.2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestCommand {
  cwd?: string;
  shell: string;
  rationale: string;
}

export interface SuggestCommandsRequest {
  workspacePath: string;
  changedFiles: string[];
  packageHint?: "backend" | "database" | "desktop" | "auto";
}

export interface SuggestCommandsResult {
  commands: TestCommand[];
}

export interface TriageRequest {
  workspacePath: string;
  runnerOutput: string;
  runner?: "vitest" | "jest" | "unknown";
}

export interface TriageResult {
  summary: string;
  bullets: string[];
  suggestedCommands: string[];
}

// ---------------------------------------------------------------------------
// Kill-switch
// ---------------------------------------------------------------------------

export function isTestAssistantEnabled(): boolean {
  const v = process.env["VIPER_TEST_ASSISTANT_ENABLED"] ?? "";
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
  return process.env["VIPER_TEST_ASSISTANT_MODEL"] ?? "gpt-4o-mini";
}

// ---------------------------------------------------------------------------
// Package registry for this monorepo
// ---------------------------------------------------------------------------

interface PackageEntry {
  /** Matches if the file path starts with this prefix */
  prefix: string;
  cwd: string;
  testRunner: string;
  /** How to run a specific test file: %FILE% replaced with the relative test path */
  singleFileTemplate?: string;
}

const PACKAGE_REGISTRY: PackageEntry[] = [
  {
    prefix: "apps/backend/",
    cwd: "apps/backend",
    testRunner: "npx vitest run",
    singleFileTemplate: "npx vitest run %FILE%",
  },
  {
    prefix: "packages/database/",
    cwd: "packages/database",
    testRunner: "npm test",
    singleFileTemplate: "npx vitest run %FILE%",
  },
  {
    prefix: "apps/viper-desktop/ui/",
    cwd: "apps/viper-desktop",
    testRunner: "npm test",
  },
  {
    prefix: "packages/agents/",
    cwd: "packages/agents",
    testRunner: "npm test",
  },
];

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

/**
 * Given a source file path (relative to monorepo root), derive the most
 * plausible test file path by basename substitution.
 *
 * e.g. apps/backend/src/lib/foo.ts → apps/backend/src/lib/foo.test.ts
 *
 * Limitations: does not verify the file exists; co-location assumed.
 */
export function deriveTestFilePath(filePath: string): string | null {
  const ext = path.extname(filePath);
  if (!ext) return null;

  const base = filePath.slice(0, filePath.length - ext.length);

  // Already a test file
  if (base.endsWith(".test") || base.endsWith(".spec")) return filePath;

  // Try .test.ts/.test.tsx
  const tsExt = ext === ".tsx" ? ".tsx" : ".ts";
  return `${base}.test${tsExt}`;
}

/**
 * Map a list of changed files to test commands using heuristics only
 * (no network call). Returns an empty array when heuristics yield nothing.
 */
export function buildHeuristicCommands(
  changedFiles: string[],
): TestCommand[] {
  const capped = changedFiles.slice(0, MAX_CHANGED_FILES);

  // Group by package
  const byPackage = new Map<PackageEntry, Set<string>>();

  for (const file of capped) {
    const entry = PACKAGE_REGISTRY.find((e) => file.startsWith(e.prefix));
    if (!entry) continue;

    if (!byPackage.has(entry)) byPackage.set(entry, new Set());

    const testFile = deriveTestFilePath(file);
    if (testFile) byPackage.get(entry)!.add(testFile);
  }

  const commands: TestCommand[] = [];

  for (const [entry, testFiles] of byPackage.entries()) {
    if (testFiles.size === 0) {
      // Changed file in this package but no test file derivable → run all
      commands.push({
        cwd: entry.cwd,
        shell: entry.testRunner,
        rationale: `Run all tests in ${entry.cwd} (no co-located test file found for changed files).`,
      });
      continue;
    }

    if (testFiles.size <= 3 && entry.singleFileTemplate) {
      // Run specific test files
      for (const tf of testFiles) {
        // Strip the package prefix to get the cwd-relative path
        const rel = tf.startsWith(entry.prefix + "src/")
          ? tf.slice(entry.prefix.length)
          : tf.startsWith(entry.prefix)
          ? tf.slice(entry.prefix.length)
          : tf;

        commands.push({
          cwd: entry.cwd,
          shell: entry.singleFileTemplate.replace("%FILE%", rel),
          rationale: `Run test file ${rel} matching changed source ${tf}.`,
        });
      }
    } else {
      // Many files or no template → run all in package
      commands.push({
        cwd: entry.cwd,
        shell: entry.testRunner,
        rationale: `Run all tests in ${entry.cwd} (${testFiles.size} test files affected).`,
      });
    }
  }

  return commands;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

export function buildSuggestCommandsPrompt(
  changedFiles: string[],
  packageHint: string,
  heuristicCommands: TestCommand[],
): string {
  const fileList = changedFiles.slice(0, MAX_CHANGED_FILES).join("\n");
  const heuristics = heuristicCommands.length
    ? `Heuristic commands already derived:\n${JSON.stringify(heuristicCommands, null, 2)}\n\nAugment or correct these if needed.`
    : "No heuristic commands could be derived — suggest from scratch.";

  return `You are a senior engineer helping run targeted tests in a TypeScript monorepo.

Monorepo layout:
- apps/backend          → Fastify backend (vitest)
- packages/database     → PostgreSQL DB layer (vitest)
- apps/viper-desktop    → Electron desktop app (vitest/jest)
- packages/agents       → Agent packages (vitest)

Package hint: ${packageHint}

Changed files:
${fileList}

${heuristics}

Return a JSON object:
{
  "commands": [
    { "cwd": "<relative path from repo root>", "shell": "<shell command>", "rationale": "<1 sentence>" }
  ]
}

Rules:
- Return at most 3 commands.
- Prefer specific file filters over running entire suites when possible.
- Use "npx vitest run <path>" for vitest packages.
- cwd must be one of: apps/backend, packages/database, apps/viper-desktop, packages/agents.
- Do NOT include markdown fences. Return only the raw JSON.`;
}

export function buildTriagePrompt(
  runnerOutput: string,
  runner: string,
): string {
  const truncated = runnerOutput.slice(0, MAX_RUNNER_OUTPUT_CHARS);
  return `You are a senior engineer triaging a test failure.

Test runner: ${runner}

--- OUTPUT ---
${truncated}
--- END OUTPUT ---

Analyze the failure and return a JSON object:
{
  "summary": "<1–2 sentence plain-English summary of what failed and why>",
  "bullets": ["<key observation 1>", "<key observation 2>", "<up to 4 bullets total>"],
  "suggestedCommands": ["<command 1>", "<command 2>"]
}

Rules:
- summary: concise, no markdown.
- bullets: highlight the root cause, affected test(s), and key error messages.
- suggestedCommands: 1–3 shell commands to further diagnose or fix (e.g. run a single failing test with --reporter verbose).
- Do NOT include markdown fences. Return only the raw JSON.`;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export async function suggestTestCommands(
  req: SuggestCommandsRequest,
): Promise<SuggestCommandsResult> {
  const identity = {
    request_id: `testing-suggest-${Date.now()}`,
    workspace_id: req.workspacePath,
    conversation_id: null,
  };

  workflowLog("testing:assistant:requested", identity, {
    mode: "suggest",
    fileCount: req.changedFiles.length,
    packageHint: req.packageHint ?? "auto",
  });

  // Fast path: pure heuristics
  const heuristic = buildHeuristicCommands(req.changedFiles);

  // If heuristics yield 1–3 commands and all files are in known packages,
  // skip the AI call
  const allKnown = req.changedFiles
    .slice(0, MAX_CHANGED_FILES)
    .every((f) => PACKAGE_REGISTRY.some((e) => f.startsWith(e.prefix)));

  if (heuristic.length > 0 && allKnown && heuristic.length <= 3) {
    workflowLog("testing:assistant:completed", identity, {
      mode: "suggest",
      source: "heuristic",
      count: heuristic.length,
    });
    return { commands: heuristic };
  }

  // Fall through to AI for unknown packages or complex cases
  const prompt = buildSuggestCommandsPrompt(
    req.changedFiles,
    req.packageHint ?? "auto",
    heuristic,
  );

  const client = getOpenAIClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: getModel(),
        messages: [{ role: "user", content: prompt }],
        max_tokens: 512,
        temperature: TEST_TEMPERATURE,
        response_format: { type: "json_object" },
      },
      { signal: controller.signal },
    );

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { commands?: TestCommand[] };
    const commands = (parsed.commands ?? heuristic).slice(0, 3);

    workflowLog("testing:assistant:completed", identity, {
      mode: "suggest",
      source: "ai",
      count: commands.length,
    });

    return { commands: commands.length ? commands : heuristic };
  } finally {
    clearTimeout(timer);
  }
}

export async function triageFailure(
  req: TriageRequest,
): Promise<TriageResult> {
  const identity = {
    request_id: `testing-triage-${Date.now()}`,
    workspace_id: req.workspacePath,
    conversation_id: null,
  };

  workflowLog("testing:assistant:requested", identity, {
    mode: "triage",
    runner: req.runner ?? "unknown",
    outputLen: req.runnerOutput.length,
  });

  const prompt = buildTriagePrompt(req.runnerOutput, req.runner ?? "unknown");
  const client = getOpenAIClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: getModel(),
        messages: [{ role: "user", content: prompt }],
        max_tokens: 768,
        temperature: TEST_TEMPERATURE,
        response_format: { type: "json_object" },
      },
      { signal: controller.signal },
    );

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      summary?: string;
      bullets?: string[];
      suggestedCommands?: string[];
    };

    const result: TriageResult = {
      summary: (parsed.summary ?? "").trim() || "Analysis completed.",
      bullets: (parsed.bullets ?? []).slice(0, 4),
      suggestedCommands: (parsed.suggestedCommands ?? []).slice(0, 3),
    };

    workflowLog("testing:assistant:completed", identity, {
      mode: "triage",
      bulletCount: result.bullets.length,
      commandCount: result.suggestedCommands.length,
    });

    return result;
  } finally {
    clearTimeout(timer);
  }
}
