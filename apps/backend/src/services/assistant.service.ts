import OpenAI from "openai";
import { buildCacheKey, createMemoryCache, hashString, withRetry } from "@repo/shared";
import { buildExecutionPlan, type ExecutionPlan } from "@repo/planner-agent";
import { executePlan } from "@repo/execution-engine";
import type { OnStreamEvent } from "@repo/execution-engine";
import type { RequestIdentity } from "../types/request-identity.js";
import type { ChatMode } from "../validators/request.schemas.js";
import { validateWorkflowLog } from "../types/workflow-log-schema.js";
// runAutonomousLoop no longer used in the streaming path (replaced by agentic loop)
import {
  runIntentPipeline,
  getIntentAgentAdapter,
  runIntentReasoning,
} from "../lib/intent-agent-loader.js";
import { routeTools } from "../router/tool-router/index.js";
import { buildRawContext, type ContextBuilderAdapter } from "@repo/context-builder";
import {
  type ContextWindow,
  generateCandidates,
  computeCandidateScores,
  combineScores,
  selectTopK,
  CONTEXT_LIMITS,
  buildContextWindow,
  buildRetrievalConfidence,
} from "@repo/context-ranking";
import { getPool } from "@repo/database";
import { createContextAdapter } from "../adapters/context-builder.adapter.js";
import { runCodebaseAnalysisIfConfigured } from "./analysis-options.service.js";
import { getRepoId } from "./workspace.service.js";
import {
  injectMemoryIntoPrompt,
  buildMemorySnapshot,
  recordIntent,
  recordToolResult,
  recordTurnSummary,
  buildRichMemoryContext,
  registerDbAdapter,
  type SessionKey,
  type MemorySnapshot,
  type MemoryEntry,
} from "@repo/memory-agent";
import {
  insertMemoryEntry as dbInsertMemoryEntry,
  getMemoryEntriesBySession as dbGetMemoryEntries,
  searchMemoryByKeywords as dbSearchMemoryKeywords,
} from "@repo/database";
import {
  readWorkspaceFile,
  listWorkspaceDirectory,
  runWorkspaceCommand,
} from "@repo/workspace-tools";
import { attachAnalysisGateForEdits } from "../lib/analysis-edit-gate.js";
import { runPostEditValidationWithOptionalAutoRepair } from "../lib/post-edit-validation.js";
import {
  runAgenticLoop,
  buildAgenticSystemPrompt,
  buildWorkspaceTools,
  type AgenticLoopPausedState,
} from "@repo/agentic-loop";
import { workflowRuntimeConfig } from "../config/workflow-flags.js";
import { shouldBlockEditForRetrievalConfidence } from "../lib/retrieval-edit-gate.js";

const FALLBACK_NO_CONTEXT = "No relevant code found in repository.";

/**
 * In-memory store for paused agentic loop states.
 * Key: conversationId — one paused state per conversation.
 * When the user's next message comes in, we check if there's a paused
 * state for that conversation and resume the loop from where it left off.
 */
const pausedLoopStates = new Map<string, {
  state: AgenticLoopPausedState;
  workspacePath: string;
  intentSummary: { intent: string; summary: string };
  stepNumber: number;
}>();

const {
  debugAssistant: DEBUG_ASSISTANT,
  debugWorkflow: DEBUG_WORKFLOW,
  enableStreamContextPrimer: ENABLE_STREAM_CONTEXT_PRIMER,
  streamAnalysisWarmupMs: STREAM_ANALYSIS_WARMUP_MS,
  requireAnalysisForEdits: REQUIRE_ANALYSIS_FOR_EDITS,
  minFilesReadBeforeEdit: MIN_FILES_READ_BEFORE_EDIT,
  minDiscoveryToolsBeforeEdit: MIN_DISCOVERY_TOOLS_BEFORE_EDIT,
  openaiModel: OPENAI_MODEL,
  disableLlmCache: DISABLE_LLM_CACHE,
  directLlmCacheTtl: DIRECT_LLM_CACHE_TTL,
  chatHistoryLimit: CHAT_HISTORY_LIMIT,
  runAnalysisWaitMs: RUN_ANALYSIS_WAIT_MS,
  minRetrievalConfidenceForEdits: MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS,
  enablePostEditValidation: ENABLE_POST_EDIT_VALIDATION,
  postEditValidationCommand: POST_EDIT_VALIDATION_COMMAND,
  postEditValidationTimeoutMs: POST_EDIT_VALIDATION_TIMEOUT_MS,
  enablePostEditAutoRepair: ENABLE_POST_EDIT_AUTO_REPAIR,
  postEditAutoRepairCommand: POST_EDIT_AUTO_REPAIR_COMMAND,
  postEditAutoRepairMaxExtraValidationRuns: POST_EDIT_AUTO_REPAIR_MAX_EXTRA_VALIDATION_RUNS,
  postEditAutoRepairTimeoutMs: POST_EDIT_AUTO_REPAIR_TIMEOUT_MS,
} = workflowRuntimeConfig;

const DIRECT_LLM_SYSTEM_PROMPT =
  "You are an AI assistant inside a developer's IDE. Answer clearly and professionally. " +
  "Use short paragraphs and numbered steps (1. 2. 3.) or plain lines — not markdown. " +
  "Never use markdown: no ** bold, no # headings, no backticks, no --- lines. Plain text only. " +
  "Do not mention internal system labels (Intent, Entities, planner, reflection, execution steps). " +
  "If asked how to run or install the project, give concrete commands (npm/pnpm/yarn, pip, docker, etc.) and suggest checking README or package.json when the stack is unknown.";

// ---------------------------------------------------------------------------
// Wire database adapter for persistent memory (best-effort, fails gracefully)
// ---------------------------------------------------------------------------
let dbAdapterInitialized = false;

function ensureDbMemoryAdapter(): void {
  if (dbAdapterInitialized) return;
  dbAdapterInitialized = true;
  try {
    const pool = getPool();
    registerDbAdapter({
      insert: async (workspacePath, conversationId, entry) => {
        await dbInsertMemoryEntry(pool, {
          workspace_path: workspacePath,
          conversation_id: conversationId,
          entry_type: entry.type,
          content: entry.content,
          meta: entry.meta as unknown as Record<string, unknown>,
          weight: entry.weight,
        });
      },
      load: async (workspacePath, conversationId, limit) => {
        const rows = await dbGetMemoryEntries(pool, workspacePath, conversationId, limit);
        return rows.map((r) => ({
          id: r.id,
          type: r.entry_type as MemoryEntry["type"],
          content: r.content,
          timestamp: new Date(r.created_at).getTime(),
          meta: r.meta as unknown as MemoryEntry["meta"],
          weight: r.weight,
        }));
      },
      search: async (workspacePath, keywords, limit) => {
        const rows = await dbSearchMemoryKeywords(pool, workspacePath, keywords, limit);
        return rows.map((r) => ({
          id: r.id,
          type: r.entry_type as MemoryEntry["type"],
          content: r.content,
          timestamp: new Date(r.created_at).getTime(),
          meta: r.meta as unknown as MemoryEntry["meta"],
          weight: r.weight,
        }));
      },
    });
  } catch {
    if (DEBUG_ASSISTANT) log("DB memory adapter not available; using in-process only");
  }
}

/** Thrown when the HTTP client closes the SSE connection so we stop burning tokens/CPU. */
export class ClientDisconnectedError extends Error {
  override readonly name = "ClientDisconnectedError";
  constructor() {
    super("Client disconnected");
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ClientDisconnectedError();
}

async function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  let onAbort: () => void;
  const aborted = new Promise<never>((_, rej) => {
    onAbort = () => rej(new ClientDisconnectedError());
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort!);
  }
}

/** SSE keepalives during long waits so proxies/clients don’t close an idle stream. */
async function sleepWithStreamKeepalives(
  totalMs: number,
  onEvent: OnStreamEvent,
  tickMs = 5000,
  signal?: AbortSignal,
): Promise<void> {
  if (totalMs <= 0) return;
  const end = Date.now() + totalMs;
  while (Date.now() < end) {
    throwIfAborted(signal);
    const remaining = end - Date.now();
    const slice = Math.min(tickMs, remaining);
    await withAbort(new Promise<void>((r) => setTimeout(r, slice)), signal);
    if (Date.now() < end) {
      onEvent({ type: "keepalive", data: {} });
    }
  }
}

/** Ping periodically while async work runs (repo scan + runFullAnalysis can take many seconds). */
async function withStreamKeepalivesDuring<T>(
  work: Promise<T>,
  onEvent: OnStreamEvent,
  tickMs = 5000,
  signal?: AbortSignal,
): Promise<T> {
  const id = setInterval(() => {
    if (signal?.aborted) return;
    onEvent({ type: "keepalive", data: {} });
  }, tickMs);
  try {
    return await withAbort(work, signal);
  } finally {
    clearInterval(id);
  }
}

const directLLMCache = createMemoryCache<AssistantPipelineResult>();

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set it in .env for direct LLM and intent reasoning.",
    );
  }
  return new OpenAI({ apiKey });
}

/** Final user-facing recap of a proposed patch (replaces raw streamed JSON + noisy reflection dumps). */
async function streamProposalSummaryLLM(
  userPrompt: string,
  files: string[],
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (files.length === 0) return undefined;
  try {
    const client = getOpenAIClient();
    const model = OPENAI_MODEL;
    const completion = await withAbort(
      client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "Write 2-4 short sentences in plain English for an IDE user. Describe what was proposed (which files and what changed). Rules: no markdown (no **, no # headings, no bullets, no backticks), no file paths in monospace, no JSON, no code, no internal labels like Intent/Entities/REFLECTION. Mention filenames as normal words.",
          },
          {
            role: "user",
            content: `User request: ${userPrompt}\n\nFiles in the proposed patch: ${files.join(", ")}\n\nSummarize what the assistant prepared for the user.`,
          },
        ],
        max_tokens: 220,
        temperature: 0.3,
      }),
      signal,
    );
    return completion.choices[0]?.message?.content?.trim() || undefined;
  } catch (e) {
    log("Proposal summary LLM failed", e);
    return undefined;
  }
}

export interface AssistantPipelineResult {
  intent: { intent: string; summary: string };
  context: {
    files: string[];
    functions: string[];
    snippets: string[];
    estimatedTokens: number;
  };
  /** For code-related intents: what's in place, what's missing, suggested next step. */
  reasoning?: {
    detectedComponents: string[];
    missingComponents: string[];
    potentialIssues: string[];
    recommendedNextStep?: string;
  };
  /** Short user-facing recap after patch preview (LLM), not raw JSON. */
  proposalSummary?: string;
}

function log(message: string, data?: unknown): void {
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.log(`[Viper] ${message}`, data !== undefined ? data : "");
  }
}

function workflowLog(stage: string, identity: RequestIdentity | null, data?: Record<string, unknown>): void {
  if (!(DEBUG_ASSISTANT || DEBUG_WORKFLOW)) return;
  const idFields = identity
    ? { request_id: identity.request_id, workspace_id: identity.workspace_id, conversation_id: identity.conversation_id }
    : { request_id: "unknown", workspace_id: "unknown", conversation_id: null };
  const merged = { ...idFields, ...data };

  if (DEBUG_WORKFLOW) {
    const result = validateWorkflowLog(stage, merged);
    if (!result.valid) {
      log(
        `[workflow:schema-warning] stage="${stage}" validation failed: ${result.issues.join("; ")}`,
        { ...idFields, workflow_stage: stage, issues: result.issues },
      );
    }
  }

  // Always emit the original workflow log line (best-effort) even if the schema check fails.
  log(`[workflow] ${stage}`, merged);
}

function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 503;
}

function toRoutingTasks(plan: ExecutionPlan): { tasks: Array<{ type: string }> } {
  return {
    tasks: plan.steps.map((step) => ({ type: step.type })),
  };
}

/** Seeds for embedding search so manifests / README / run scripts surface for setup questions. */
function projectSetupSeedTerms(query: string, entities: string[]): string[] {
  const base = [
    ...entities,
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "README",
    "README.md",
    "docker-compose",
    "Makefile",
    "Cargo.toml",
    "pyproject.toml",
    "requirements.txt",
    "setup.py",
    "run",
    "dev",
    "start",
    "install",
    "build",
  ];
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  return [...new Set([...base, ...words.slice(0, 8)])].slice(0, 22);
}

function formatContextWindowForPrompt(w: ContextWindow): string {
  const parts: string[] = [];
  if (w.files.length) parts.push(`Referenced files: ${w.files.join(", ")}`);
  if (w.functions.length) parts.push(`Referenced symbols: ${w.functions.join(", ")}`);
  if (w.snippets.length) {
    parts.push("Snippets from the workspace index:");
    w.snippets.forEach((s, i) => parts.push(`--- ${i + 1} ---\n${s}`));
  }
  return parts.join("\n\n") || "(No indexed snippets matched — infer from common conventions if needed.)";
}

function guidanceSeedTerms(query: string, entities: string[]): string[] {
  const qWords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2)
    .slice(0, 14);
  const extra = [
    ...entities,
    ...qWords,
    "implementation",
    "architecture",
    "README",
    "package.json",
    "TODO",
    "roadmap",
    "design",
    "module",
    "src",
  ];
  return [...new Set(extra)].slice(0, 24);
}

async function retrieveEmbeddingContextWindow(
  repo_id: string,
  query: string,
  adapter: ContextBuilderAdapter,
  entityValues: string[],
  seedTerms: string[],
): Promise<{ contextWindow: ContextWindow; confidence: ReturnType<typeof buildRetrievalConfidence> }> {
  const raw = await buildRawContext(
    repo_id,
    { embeddingSearch: seedTerms },
    adapter,
  );
  const candidates = generateCandidates(raw);
  const scored = computeCandidateScores(candidates, {
    query,
    entities: seedTerms,
    rawContext: { dependencies: raw.dependencies },
    openedFiles: [],
  });
  const ranked = combineScores(scored);
  const bundle = selectTopK(ranked, {
    files: Math.max(1, Math.round(CONTEXT_LIMITS.files * 1.2)),
    functions: Math.max(1, Math.round(CONTEXT_LIMITS.functions * 0.8)),
    snippets: Math.max(1, Math.round(CONTEXT_LIMITS.snippets * 1.2)),
  });
  const contextWindow = buildContextWindow(bundle);
  const confidence = buildRetrievalConfidence({
    rankedCandidates: ranked,
    bundle,
    contextWindow,
  });
  return { contextWindow, confidence };
}

async function retrieveProjectSetupContext(
  repo_id: string,
  query: string,
  adapter: ContextBuilderAdapter,
  entityValues: string[],
): Promise<{ contextWindow: ContextWindow; confidence: ReturnType<typeof buildRetrievalConfidence> }> {
  return retrieveEmbeddingContextWindow(
    repo_id,
    query,
    adapter,
    entityValues,
    projectSetupSeedTerms(query, entityValues),
  );
}

async function retrieveGuidanceContext(
  repo_id: string,
  query: string,
  adapter: ContextBuilderAdapter,
  entityValues: string[],
): Promise<{ contextWindow: ContextWindow; confidence: ReturnType<typeof buildRetrievalConfidence> }> {
  return retrieveEmbeddingContextWindow(
    repo_id,
    query,
    adapter,
    entityValues,
    guidanceSeedTerms(query, entityValues),
  );
}

/**
 * B.7 — One hybrid retrieval pass to seed `RetrievalConfidenceV1.overall` for agentic edit gating.
 * On failure: returns overall 0 (strict gate), logs debug-only — does not throw.
 */
async function seedRetrievalConfidenceForAgenticEditGate(
  repo_id: string,
  historyAwarePrompt: string,
  entityValues: string[],
  onEvent: OnStreamEvent,
): Promise<{ overall: number; schemaVersion?: string }> {
  try {
    const adapter =
      resolveAdapter(repo_id) ??
      ((await getIntentAgentAdapter()) as unknown as ContextBuilderAdapter);
    const seedTerms = guidanceSeedTerms(historyAwarePrompt, entityValues);
    const { confidence } = await retrieveEmbeddingContextWindow(
      repo_id,
      historyAwarePrompt,
      adapter,
      entityValues,
      seedTerms,
    );
    onEvent({ type: "retrieval:confidence", data: confidence });
    return { overall: confidence.overall, schemaVersion: confidence.schema_version };
  } catch (err) {
    if (DEBUG_ASSISTANT || DEBUG_WORKFLOW) {
      log("Agentic seed retrieval failed; treating retrieval overall as 0 for edit gate", err);
    }
    return { overall: 0 };
  }
}

/** Max total bytes of file content to inject into a single LLM prompt. */
const MAX_FILE_CONTEXT_BYTES = 32 * 1024; // ~32 KB ≈ ~8K tokens

/** Files always worth reading if they exist (in priority order). */
const KEY_FILES = [
  "package.json",
  "README.md",
  "README",
  "tsconfig.json",
  "pyproject.toml",
  "Cargo.toml",
  "requirements.txt",
  "docker-compose.yml",
  "docker-compose.yaml",
  "Makefile",
  ".env.example",
];

/**
 * Reads actual workspace files and project structure, then returns an enriched
 * context string suitable for injection into the LLM system message.
 *
 * Flow:
 *  1. List the project root to understand structure
 *  2. Read key config/manifest files (package.json, README, etc.)
 *  3. Read files that the embedding index identified as relevant (ctx.files)
 *  4. Emit tool:start / tool:result events for UI feedback
 */
async function enrichContextWithFileContents(
  workspacePath: string,
  embeddingFiles: string[],
  onEvent: OnStreamEvent,
  signal?: AbortSignal,
): Promise<string> {
  const parts: string[] = [];
  let totalBytes = 0;
  const readFiles: string[] = [];

  const emit = (tool: string, summary: string) => {
    onEvent({
      type: "tool:result" as const,
      data: { tool, summary, durationMs: 0 },
    } as Parameters<OnStreamEvent>[0]);
  };

  // 1. Project structure
  onEvent({
    type: "tool:start" as const,
    data: { tool: "list_directory", args: { path: "." } },
  } as Parameters<OnStreamEvent>[0]);
  throwIfAborted(signal);

  const listing = await listWorkspaceDirectory(workspacePath, ".", {
    maxDepth: 3,
    maxEntries: 120,
  });
  if (listing.entries.length > 0) {
    const tree = listing.entries
      .map((e) => (e.type === "directory" ? `${e.name}/` : e.name))
      .join("\n");
    parts.push(`Project structure:\n${tree}`);
    totalBytes += tree.length;
  }
  emit("list_directory", `${listing.entries.length} entries`);

  // 2. Key manifest/config files
  for (const keyFile of KEY_FILES) {
    if (totalBytes >= MAX_FILE_CONTEXT_BYTES) break;
    throwIfAborted(signal);

    if (readFiles.includes(keyFile)) continue;
    const exists = listing.entries.some(
      (e) => e.type === "file" && e.name === keyFile,
    );
    if (!exists) continue;

    onEvent({
      type: "tool:start" as const,
      data: { tool: "read_file", args: { path: keyFile } },
    } as Parameters<OnStreamEvent>[0]);

    const result = await readWorkspaceFile(workspacePath, keyFile);
    if (result) {
      const content = result.content.slice(0, MAX_FILE_CONTEXT_BYTES - totalBytes);
      parts.push(
        `--- ${keyFile} (${result.lines} lines${result.truncated ? ", truncated" : ""}) ---\n${content}`,
      );
      totalBytes += content.length;
      readFiles.push(keyFile);
      emit("read_file", `Read ${keyFile} (${result.lines} lines)`);
    }
  }

  // 3. Embedding-identified files (skip those already read)
  const remainingFiles = embeddingFiles.filter((f) => !readFiles.includes(f));
  for (const filePath of remainingFiles.slice(0, 8)) {
    if (totalBytes >= MAX_FILE_CONTEXT_BYTES) break;
    throwIfAborted(signal);

    onEvent({
      type: "tool:start" as const,
      data: { tool: "read_file", args: { path: filePath } },
    } as Parameters<OnStreamEvent>[0]);

    const result = await readWorkspaceFile(workspacePath, filePath);
    if (result) {
      const content = result.content.slice(0, MAX_FILE_CONTEXT_BYTES - totalBytes);
      parts.push(
        `--- ${filePath} (${result.lines} lines${result.truncated ? ", truncated" : ""}) ---\n${content}`,
      );
      totalBytes += content.length;
      readFiles.push(filePath);
      emit("read_file", `Read ${filePath} (${result.lines} lines)`);
    }
  }

  onEvent({
    type: "context:explored" as const,
    data: {
      files: readFiles,
      counts: {
        files: readFiles.length,
        functions: 0,
        tokens: Math.ceil(totalBytes / 4),
      },
    },
  } as Parameters<OnStreamEvent>[0]);

  return parts.join("\n\n") || "(No workspace files could be read.)";
}

/**
 * Synchronous (non-stream) version of enrichContextWithFileContents.
 * Used by the non-streaming runAssistantPipeline path.
 */
async function enrichContextSync(
  workspacePath: string,
  embeddingFiles: string[],
): Promise<{ block: string; readFiles: string[] }> {
  const parts: string[] = [];
  let totalBytes = 0;
  const readFiles: string[] = [];

  const listing = await listWorkspaceDirectory(workspacePath, ".", {
    maxDepth: 3,
    maxEntries: 120,
  });
  if (listing.entries.length > 0) {
    const tree = listing.entries
      .map((e) => (e.type === "directory" ? `${e.name}/` : e.name))
      .join("\n");
    parts.push(`Project structure:\n${tree}`);
    totalBytes += tree.length;
  }

  for (const keyFile of KEY_FILES) {
    if (totalBytes >= MAX_FILE_CONTEXT_BYTES) break;
    if (readFiles.includes(keyFile)) continue;
    const exists = listing.entries.some(
      (e) => e.type === "file" && e.name === keyFile,
    );
    if (!exists) continue;

    const result = await readWorkspaceFile(workspacePath, keyFile);
    if (result) {
      const content = result.content.slice(0, MAX_FILE_CONTEXT_BYTES - totalBytes);
      parts.push(
        `--- ${keyFile} (${result.lines} lines${result.truncated ? ", truncated" : ""}) ---\n${content}`,
      );
      totalBytes += content.length;
      readFiles.push(keyFile);
    }
  }

  const remaining = embeddingFiles.filter((f) => !readFiles.includes(f));
  for (const filePath of remaining.slice(0, 8)) {
    if (totalBytes >= MAX_FILE_CONTEXT_BYTES) break;
    const result = await readWorkspaceFile(workspacePath, filePath);
    if (result) {
      const content = result.content.slice(0, MAX_FILE_CONTEXT_BYTES - totalBytes);
      parts.push(
        `--- ${filePath} (${result.lines} lines${result.truncated ? ", truncated" : ""}) ---\n${content}`,
      );
      totalBytes += content.length;
      readFiles.push(filePath);
    }
  }

  return {
    block: parts.join("\n\n") || "(No workspace files could be read.)",
    readFiles,
  };
}

/**
 * Initial status narration while the codebase index is refreshed (all execution paths that use analysis).
 * Plain English — never emit internal step codes.
 */
async function streamInitialThinkingLLM(
  userPrompt: string,
  intentType: string,
  onEvent: OnStreamEvent,
  signal?: AbortSignal,
): Promise<void> {
  const client = getOpenAIClient();
  onEvent({ type: "thinking:start", data: {} });
  const stream = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Write 2-5 short sentences for an IDE user. You are narrating while the workspace is indexed and embeddings are updated so the assistant can answer accurately. Be warm and clear. Plain English only — no markdown headings, no bullet lists, no internal symbols (never say SEARCH_SYMBOL, GENERATE_PATCH, etc.).",
      },
      {
        role: "user",
        content: `The user asked: "${userPrompt}"\n\nTone hint (do not quote): intent ${intentType}. Briefly explain you're preparing context from their repository.`,
      },
    ],
    stream: true,
    temperature: 0.35,
    max_tokens: 220,
  });
  for await (const chunk of stream) {
    throwIfAborted(signal);
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) onEvent({ type: "thinking:delta", data: { content: delta } });
  }
  onEvent({ type: "thinking:complete", data: {} });
}

/** Human-readable plan — streamed before tool execution (replaces raw SEARCH_* labels in the UI). */
async function streamPlanNarrativeLLM(
  userPrompt: string,
  intentType: string,
  plan: ExecutionPlan,
  onEvent: OnStreamEvent,
  signal?: AbortSignal,
): Promise<void> {
  const client = getOpenAIClient();
  const stepLines = plan.steps.map((s, i) => {
    const human = (s.description ?? s.type).replace(/_/g, " ");
    return `${i + 1}. ${human}`;
  });
  onEvent({ type: "plan:narrative:start", data: {} });
  const stream = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You write a clear implementation plan for a developer. Use 2-4 short paragraphs. " +
          "Describe what will happen in natural language (e.g. reviewing relevant files, searching for symbols, drafting proposed edits). " +
          "Never use internal codes like SEARCH_SYMBOL, GENERATE_PATCH, NO_OP, or SCREAMING_SNAKE_CASE step names. " +
          "No markdown # headings; you may use simple line breaks. Normalize spacing.",
      },
      {
        role: "user",
        content: `User request:\n${userPrompt}\n\nIntent (context only): ${intentType}\n\nRough steps (translate to prose, do not quote verbatim as labels):\n${stepLines.join("\n")}`,
      },
    ],
    stream: true,
    temperature: 0.35,
    max_tokens: 900,
  });
  for await (const chunk of stream) {
    throwIfAborted(signal);
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) onEvent({ type: "plan:narrative:delta", data: { content: delta } });
  }
  onEvent({ type: "plan:narrative:complete", data: {} });
}

/** Direct LLM path (optional workspace context block for PROJECT_SETUP). Uses OpenAI with cache and retry. */
async function runDirectLLM(
  prompt: string,
  lastMessages: Array<{ role: "user" | "assistant"; content: string }> = [],
  args: {
    workspaceKey: string;
    conversationId?: string;
    intentType?: string;
    /** Retrieved index snippets (manifests, README, etc.) — injected as an extra system message. */
    projectContextBlock?: string;
    /** Provenance for the client; main answer is still `snippets[0]`. */
    contextWindow?: ContextWindow;
    /** Override default preamble before the context block (e.g. CODE_GUIDANCE vs setup). */
    workspaceContextPreamble?: string;
  },
): Promise<AssistantPipelineResult> {
  const cacheKey = `direct-llm:${buildCacheKey({
    workspaceKey: args.workspaceKey,
    conversationId: args.conversationId,
    prompt,
    messages: lastMessages,
    intentType: args.intentType ?? "DIRECT_LLM",
    contextHash: args.projectContextBlock
      ? hashString(args.projectContextBlock.slice(0, 16000))
      : "",
  })}`;
  const canUseCache =
    DIRECT_LLM_CACHE_TTL > 0 &&
    Boolean(args.conversationId) &&
    !args.projectContextBlock;
  if (canUseCache) {
    const cached = await directLLMCache.get(cacheKey);
    if (cached !== null) {
      if (process.env.NODE_ENV !== "test") {
        console.log("[Viper] LLM cache hit");
      }
      return cached;
    }
  }
  if (process.env.NODE_ENV !== "test") {
    console.log("[Viper] LLM cache miss");
  }

  try {
    if (process.env.NODE_ENV !== "test") {
      console.log("[Viper] Direct LLM response generated");
    }
    const client = getOpenAIClient();
    const ctx = args.projectContextBlock?.trim();
    const preamble =
      args.workspaceContextPreamble ??
      "Workspace context from the project index (use for accurate run/install commands):\n\n";
    const response = await withRetry(
      () =>
        client.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            {
              role: "system",
              content: DIRECT_LLM_SYSTEM_PROMPT,
            },
            ...(ctx
              ? [
                  {
                    role: "system" as const,
                    content: preamble + ctx,
                  },
                ]
              : []),
            ...lastMessages.slice(-CHAT_HISTORY_LIMIT).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        }),
      { maxRetries: 3, retryDelayMs: 500, isRetryable: isRetryableError },
    );
    const content =
      response.choices[0]?.message?.content?.trim() ?? FALLBACK_NO_CONTEXT;
    const estimatedTokens = Math.ceil(content.length / 4);
    const cw = args.contextWindow;
    const result: AssistantPipelineResult = {
      intent: {
        intent: args.intentType ?? "GENERIC",
        summary: cw
          ? args.intentType === "CODE_GUIDANCE"
            ? "Guidance (workspace context)"
            : "Project setup (workspace context)"
          : "General question",
      },
      context: {
        files: cw?.files ?? [],
        functions: cw?.functions ?? [],
        snippets: [content],
        estimatedTokens: (cw?.estimatedTokens ?? 0) + estimatedTokens,
      },
    };
    if (canUseCache) {
      await directLLMCache.set(cacheKey, result, DIRECT_LLM_CACHE_TTL);
    }
    return result;
  } catch (error) {
    console.error("[Viper] Direct LLM provider error", error);
    throw new Error(
      "Direct LLM request failed. Check OPENAI_API_KEY and network.",
    );
  }
}

function resolveAdapter(repo_id: string): ContextBuilderAdapter | null {
  const databaseUrl = process.env.DATABASE_URL;
  const qdrantUrl = process.env.QDRANT_URL ?? "http://localhost:6333";
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (databaseUrl && openaiApiKey) {
    return createContextAdapter({
      repo_id,
      pool: getPool(),
      qdrantUrl,
      openaiApiKey,
    });
  }
  return null;
}

export async function runAssistantPipeline(
  prompt: string,
  workspacePath: string,
  identity: RequestIdentity,
  conversationId?: string,
  messages: Array<{ role: "user" | "assistant"; content: string }> = [],
  chatMode: ChatMode = "agent",
): Promise<AssistantPipelineResult> {
  if (DEBUG_ASSISTANT) log("Chat pipeline (B.11 mode — tool policy deferred to step 12)", { chatMode });
  const lastMessages = messages.slice(-CHAT_HISTORY_LIMIT);
  const workspaceKey = workspacePath.replace(/\\/g, "/").replace(/\/$/, "");
  const historyAwarePrompt =
    lastMessages.length > 0
      ? `${lastMessages
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n")}\nUser: ${prompt}`
      : prompt;

  // 1. Intent classification (pure, no LLM reasoning or context)
  const intentResult = await runIntentPipeline(historyAwarePrompt, {
    cacheContext: {
      workspaceKey,
      conversationId,
      messages: lastMessages,
      contextHash: "",
    },
    skipReasoning: true,
    skipContextRequest: true,
  });

  // 2. Execution plan from intent + entities
  const plan = buildExecutionPlan(
    intentResult.intent.intentType,
    intentResult.entities.entities.map((entity) => entity.value),
  );
  if (DEBUG_ASSISTANT) log("Execution Plan:", plan);

  const tasksForRouting = toRoutingTasks(plan);

  if (DEBUG_ASSISTANT) {
    log("Intent classification", {
      intentType: intentResult.intent.intentType,
      summary: intentResult.response?.summary ?? intentResult.intent.intentType,
    });
  }

  // 3. Routing decision
  const decision = routeTools(
    intentResult.intent,
    intentResult.entities,
    tasksForRouting,
  );
  if (DEBUG_ASSISTANT) log("Routing decision", decision);

  const contextualDirectGuided =
    decision.directLLMResponse &&
    decision.runContextEngine &&
    (intentResult.intent.intentType === "PROJECT_SETUP" ||
      intentResult.intent.intentType === "CODE_GUIDANCE");

  if (decision.directLLMResponse && !decision.runContextEngine) {
    if (DEBUG_ASSISTANT) log("Direct LLM response (skipping context retrieval)");
    return await runDirectLLM(prompt, lastMessages, {
      workspaceKey,
      conversationId,
      intentType: intentResult.intent.intentType,
    });
  }

  if (contextualDirectGuided) {
    const intentType = intentResult.intent.intentType;
    if (DEBUG_ASSISTANT) log(`${intentType}: analysis + retrieval + direct LLM`);
    const repo_id = getRepoId(workspacePath);
    await runCodebaseAnalysisIfConfigured(workspacePath, repo_id);
    const waitMs = RUN_ANALYSIS_WAIT_MS;
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    const adapter =
      resolveAdapter(repo_id) ??
      ((await getIntentAgentAdapter()) as unknown as ContextBuilderAdapter);
    const entities = intentResult.entities.entities.map((e) => e.value);
    const { contextWindow: ctx, confidence: retrievalConfidence } =
      intentType === "CODE_GUIDANCE"
        ? await retrieveGuidanceContext(repo_id, historyAwarePrompt, adapter, entities)
        : await retrieveProjectSetupContext(repo_id, historyAwarePrompt, adapter, entities);

    if (DEBUG_WORKFLOW) {
      workflowLog("retrieval:confidence:computed", identity, {
        schema_version: retrievalConfidence.schema_version,
        overall: retrievalConfidence.overall,
        counts: retrievalConfidence.counts,
        ...(retrievalConfidence.signals ? { signals: retrievalConfidence.signals } : {}),
        ...(retrievalConfidence.index_state ? { index_state: retrievalConfidence.index_state } : {}),
      });
    }

    // Enrich with actual file contents
    const { block: fileBlock } = await enrichContextSync(workspacePath, ctx.files);
    const embeddingBlock = formatContextWindowForPrompt(ctx);
    const combinedBlock = [fileBlock, embeddingBlock].filter(Boolean).join("\n\n");

    return await runDirectLLM(prompt, lastMessages, {
      workspaceKey,
      conversationId,
      intentType,
      projectContextBlock: combinedBlock,
      contextWindow: ctx,
      workspaceContextPreamble:
        intentType === "CODE_GUIDANCE"
          ? "Workspace context (actual file contents and indexed snippets — ground your answer in this; do not invent files or APIs not shown below):\n\n"
          : "Workspace context (actual file contents and indexed snippets — use for accurate run/install commands):\n\n",
    });
  }

  // 4. Pre-flight: codebase analysis + adapter
  if (DEBUG_ASSISTANT) log("Context retrieval start");
  const repo_id = getRepoId(workspacePath);

  const analysisRan = await runCodebaseAnalysisIfConfigured(workspacePath, repo_id);
  if (analysisRan) {
    const waitMs = RUN_ANALYSIS_WAIT_MS;
    if (waitMs > 0) {
      if (DEBUG_ASSISTANT) log("Waiting for analysis pipeline", { waitMs });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  const adapter: ContextBuilderAdapter =
    resolveAdapter(repo_id) ??
    ((await getIntentAgentAdapter()) as unknown as ContextBuilderAdapter);

  // 4b. Read actual workspace files so execution has real code context
  const syncEntities = intentResult.entities.entities.map((e) => e.value);
  const { block: syncFileBlock } = await enrichContextSync(workspacePath, syncEntities);
  const syncEnrichedQuery = syncFileBlock
    ? `${historyAwarePrompt}\n\n--- Workspace file contents ---\n${syncFileBlock}`
    : historyAwarePrompt;

  // 5. Execute plan via Execution Engine
  const executionResult = await executePlan(plan, {
    repo_id,
    query: syncEnrichedQuery,
    adapter,
    workspacePath,
  });
  if (DEBUG_ASSISTANT) executionResult.logs.forEach((l) => log(l));

  const contextWindow: ContextWindow = executionResult.contextWindow ?? {
    files: [],
    functions: [],
    snippets: [],
    estimatedTokens: 0,
  };
  if (DEBUG_ASSISTANT) log("Context window size", contextWindow.estimatedTokens);

  const hasContext =
    contextWindow.files.length > 0 ||
    contextWindow.functions.length > 0 ||
    contextWindow.snippets.length > 0;

  // 6. Optional reasoning (LLM-based analysis of context)
  const reasoningFromContext = await runIntentReasoning(
    prompt,
    intentResult.intent,
    intentResult.entities,
    tasksForRouting,
    {
      files: contextWindow.files,
      functions: contextWindow.functions,
      classes: [],
      dependencies: [],
    },
    {
      cacheContext: {
        workspaceKey,
        conversationId,
        messages: lastMessages,
        contextHash: "",
      },
    },
  );

  const intentSummary = {
    intent: intentResult.response?.intent ?? intentResult.intent.intentType,
    summary:
      intentResult.response?.summary ?? intentResult.intent.intentType,
  };

  const reasoning = reasoningFromContext
    ? {
        detectedComponents: reasoningFromContext.detectedComponents ?? [],
        missingComponents: reasoningFromContext.missingComponents ?? [],
        potentialIssues: reasoningFromContext.potentialIssues ?? [],
        recommendedNextStep: reasoningFromContext.recommendedNextStep,
      }
    : undefined;

  if (!hasContext) {
    return {
      intent: intentSummary,
      context: {
        files: [],
        functions: [],
        snippets: [FALLBACK_NO_CONTEXT],
        estimatedTokens: 0,
      },
      reasoning,
    };
  }

  return {
    intent: intentSummary,
    context: {
      files: contextWindow.files,
      functions: contextWindow.functions,
      snippets: contextWindow.snippets,
      estimatedTokens: contextWindow.estimatedTokens,
    },
    reasoning,
  };
}

/** Streaming variant of runDirectLLM: emits token events as they arrive from OpenAI. */
async function runDirectLLMStream(
  prompt: string,
  lastMessages: Array<{ role: "user" | "assistant"; content: string }> = [],
  onEvent: OnStreamEvent,
  identity: RequestIdentity,
  resultIntent?: { intent: string; summary: string },
  options?: {
    projectContextBlock?: string;
    contextMeta?: Pick<ContextWindow, "files" | "functions" | "estimatedTokens">;
    workspaceContextPreamble?: string;
  },
): Promise<AssistantPipelineResult> {
  const client = getOpenAIClient();
  const ctx = options?.projectContextBlock?.trim();
  const preamble =
    options?.workspaceContextPreamble ??
    "Workspace context from the project index (use for accurate run/install commands):\n\n";

  const stream = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: DIRECT_LLM_SYSTEM_PROMPT,
      },
      ...(ctx
        ? [
            {
              role: "system" as const,
              content: preamble + ctx,
            },
          ]
        : []),
      ...lastMessages.slice(-CHAT_HISTORY_LIMIT).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    stream: true,
  });

  let content = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      content += delta;
      onEvent({ type: "token", data: { content: delta } });
    }
  }

  if (!content.trim()) {
    content = FALLBACK_NO_CONTEXT;
  }

  const estimatedTokens = Math.ceil(content.length / 4);
  const meta = options?.contextMeta;
  return {
    intent: resultIntent ?? { intent: "GENERIC", summary: "Assistant reply" },
    context: {
      files: meta?.files ?? [],
      functions: meta?.functions ?? [],
      snippets: [content],
      estimatedTokens: (meta?.estimatedTokens ?? 0) + estimatedTokens,
    },
  };
}

/**
 * Agentic execution path: LLM-driven tool-use loop.
 * The LLM decides which workspace tools to call, reads actual code, and produces
 * a grounded response. Supports multi-step edits: the loop pauses after each edit
 * so the user can approve before continuing.
 *
 * @param resumeMessages — if provided, the loop resumes from a paused state
 *   (the user said "yes, continue" after a previous edit step).
 */
async function runAgenticStreamPath(
  prompt: string,
  lastMessages: Array<{ role: "user" | "assistant"; content: string }>,
  workspacePath: string,
  onEvent: OnStreamEvent,
  intentSummary: { intent: string; summary: string },
  identity: RequestIdentity,
  signal?: AbortSignal,
  conversationId?: string,
  resumeState?: typeof pausedLoopStates extends Map<string, infer V> ? V : never,
  gateState?: { analysisReady: boolean },
  retrievalEditGate?: { overall: number; threshold: number; schemaVersion?: string },
): Promise<AssistantPipelineResult & { paused?: boolean }> {
  const client = getOpenAIClient();
  const discoveryToolsUsed = new Set<string>();
  const filesReadForGate = new Set<string>();
  /**
   * Edit gate order in `canEdit` (B.7):
   * 1) Analysis readiness (VIPER_REQUIRE_ANALYSIS_FOR_EDITS)
   * 2) Minimum files read
   * 3) Minimum discovery tool usage
   * 4) Retrieval confidence floor (when VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS > 0)
   */
  const tools = buildWorkspaceTools(workspacePath, {
    onCommandOutput: (chunk) => {
      onEvent({
        type: "command:output",
        data: { content: chunk },
      } as unknown as Parameters<OnStreamEvent>[0]);
    },
    canEdit: (toolName, path) => {
      if (REQUIRE_ANALYSIS_FOR_EDITS && !gateState?.analysisReady) {
        onEvent({
          type: "workflow:gate",
          data: {
            gate: "edit",
            status: "blocked",
            tool: toolName,
            path,
            reason: "analysis_not_ready",
            metrics: { analysisReady: false },
          },
        });
        workflowLog("edit-gate:blocked", identity, {
          toolName,
          path,
          reason: "analysis_not_ready",
        });
        return {
          allowed: false as const,
          reason:
            "Codebase analysis is still warming up. Read/search tools are available; please retry edit after indexing completes.",
        };
      }

      if (filesReadForGate.size < MIN_FILES_READ_BEFORE_EDIT) {
        onEvent({
          type: "workflow:gate",
          data: {
            gate: "edit",
            status: "blocked",
            tool: toolName,
            path,
            reason: "insufficient_files_read",
            metrics: {
              filesRead: filesReadForGate.size,
              requiredFilesRead: MIN_FILES_READ_BEFORE_EDIT,
            },
          },
        });
        workflowLog("edit-gate:blocked", identity, {
          toolName,
          path,
          reason: "insufficient_files_read",
          filesRead: filesReadForGate.size,
          requiredFilesRead: MIN_FILES_READ_BEFORE_EDIT,
        });
        return {
          allowed: false as const,
          reason: `Read more relevant files first (${filesReadForGate.size}/${MIN_FILES_READ_BEFORE_EDIT} files read).`,
        };
      }

      if (discoveryToolsUsed.size < MIN_DISCOVERY_TOOLS_BEFORE_EDIT) {
        onEvent({
          type: "workflow:gate",
          data: {
            gate: "edit",
            status: "blocked",
            tool: toolName,
            path,
            reason: "insufficient_discovery",
            metrics: {
              discoveryCount: discoveryToolsUsed.size,
              requiredDiscovery: MIN_DISCOVERY_TOOLS_BEFORE_EDIT,
            },
          },
        });
        workflowLog("edit-gate:blocked", identity, {
          toolName,
          path,
          reason: "insufficient_discovery",
          discoveryCount: discoveryToolsUsed.size,
          requiredDiscovery: MIN_DISCOVERY_TOOLS_BEFORE_EDIT,
        });
        return {
          allowed: false as const,
          reason: `Do at least ${MIN_DISCOVERY_TOOLS_BEFORE_EDIT} discovery operation(s) (list/search) before editing.`,
        };
      }

      if (
        retrievalEditGate &&
        shouldBlockEditForRetrievalConfidence(
          retrievalEditGate.overall,
          retrievalEditGate.threshold,
        )
      ) {
        onEvent({
          type: "workflow:gate",
          data: {
            gate: "edit",
            status: "blocked",
            tool: toolName,
            path,
            reason: "insufficient_retrieval_confidence",
            metrics: {
              filesRead: filesReadForGate.size,
              requiredFilesRead: MIN_FILES_READ_BEFORE_EDIT,
              discoveryCount: discoveryToolsUsed.size,
              requiredDiscovery: MIN_DISCOVERY_TOOLS_BEFORE_EDIT,
              analysisReady: gateState?.analysisReady ?? false,
              retrievalOverall: retrievalEditGate.overall,
              retrievalThreshold: retrievalEditGate.threshold,
              ...(retrievalEditGate.schemaVersion
                ? { confidenceSchemaVersion: retrievalEditGate.schemaVersion }
                : {}),
            },
          },
        });
        workflowLog("edit-gate:blocked", identity, {
          toolName,
          path,
          reason: "insufficient_retrieval_confidence",
          retrievalOverall: retrievalEditGate.overall,
          retrievalThreshold: retrievalEditGate.threshold,
        });
        return {
          allowed: false as const,
          reason:
            "Retrieval confidence is below the configured threshold. Read or search more targeted files and retry.",
        };
      }

      workflowLog("edit-gate:passed", identity, {
        toolName,
        path,
        filesRead: filesReadForGate.size,
        discoveryCount: discoveryToolsUsed.size,
        analysisReady: gateState?.analysisReady ?? false,
        ...(retrievalEditGate && retrievalEditGate.threshold > 0
          ? {
              retrievalOverall: retrievalEditGate.overall,
              retrievalThreshold: retrievalEditGate.threshold,
            }
          : {}),
      });
      onEvent({
        type: "workflow:gate",
        data: {
          gate: "edit",
          status: "passed",
          tool: toolName,
          path,
          metrics: {
            filesRead: filesReadForGate.size,
            requiredFilesRead: MIN_FILES_READ_BEFORE_EDIT,
            discoveryCount: discoveryToolsUsed.size,
            requiredDiscovery: MIN_DISCOVERY_TOOLS_BEFORE_EDIT,
            analysisReady: gateState?.analysisReady ?? false,
            ...(retrievalEditGate && retrievalEditGate.threshold > 0
              ? {
                  retrievalOverall: retrievalEditGate.overall,
                  retrievalThreshold: retrievalEditGate.threshold,
                  ...(retrievalEditGate.schemaVersion
                    ? { confidenceSchemaVersion: retrievalEditGate.schemaVersion }
                    : {}),
                }
              : {}),
          },
        },
      });
      return { allowed: true as const };
    },
  });

  const memKey: SessionKey | null = conversationId
    ? { workspacePath, conversationId }
    : null;

  // Inject rich cross-turn memory into the system prompt
  let systemPrompt = buildAgenticSystemPrompt(workspacePath);
  if (memKey) {
    try {
      const memoryBlock = await buildRichMemoryContext(memKey, prompt);
      if (memoryBlock) {
        systemPrompt += "\n\n" + memoryBlock;
      }
    } catch {
      if (DEBUG_ASSISTANT) log("Failed to build rich memory context");
    }
  }

  let openaiMessages: Parameters<typeof runAgenticLoop>[0]["messages"];
  let stepNumber = 1;

  if (resumeState) {
    stepNumber = resumeState.stepNumber + 1;
    openaiMessages = [
      ...resumeState.state.messages,
      { role: "user", content: prompt },
    ];
    if (DEBUG_ASSISTANT) log(`Resuming agentic loop from step ${stepNumber}`);
  } else {
    openaiMessages = [
      { role: "system", content: systemPrompt },
      ...lastMessages.slice(-CHAT_HISTORY_LIMIT).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: prompt },
    ];
  }

  onEvent({ type: "thinking:start", data: {} });

  const exploredFiles: string[] = [];
  const editedFiles: string[] = [];
  const toolsUsed: string[] = [];
  let thinkingCompleted = false;

  const result = await runAgenticLoop({
    client,
    model: OPENAI_MODEL,
    systemPrompt,
    messages: openaiMessages,
    tools,
    workspacePath,
    temperature: 0.2,
    maxIterations: 12,
    signal,
    onToken: (delta) => {
      if (!thinkingCompleted) {
        thinkingCompleted = true;
        onEvent({ type: "thinking:complete", data: {} });
      }
      onEvent({ type: "token", data: { content: delta } });
    },
    onToolStart: (name, args) => {
      if (!toolsUsed.includes(name)) toolsUsed.push(name);
      onEvent({
        type: "tool:start",
        data: { tool: name, args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v)])) },
      } as Parameters<OnStreamEvent>[0]);
    },
    onToolResult: (name, summary, durationMs) => {
      if (name === "list_directory" || name === "search_text" || name === "search_files") {
        discoveryToolsUsed.add(name);
      }
      if (name === "read_file") {
        const path = summary.split(" ")[0] ?? "";
        if (path) {
          filesReadForGate.add(path);
          if (!exploredFiles.includes(path)) exploredFiles.push(path);
        }
      }
      if (name === "edit_file" || name === "create_file") {
        const path = summary.split(" ")[0] ?? "";
        if (path && !editedFiles.includes(path)) editedFiles.push(path);
      }
      onEvent({
        type: "tool:result",
        data: { tool: name, summary, durationMs },
      } as Parameters<OnStreamEvent>[0]);

      if (memKey) {
        recordToolResult(memKey, {
          toolName: name,
          args: {},
          resultSummary: summary.slice(0, 200),
          durationMs,
        });
      }

      if (
        ENABLE_POST_EDIT_VALIDATION &&
        (name === "edit_file" || name === "create_file") &&
        !summary.startsWith("Tool error:")
      ) {
        void runPostEditValidationWithOptionalAutoRepair({
          workspacePath,
          command: POST_EDIT_VALIDATION_COMMAND,
          timeoutMs: POST_EDIT_VALIDATION_TIMEOUT_MS,
          toolName: name,
          onEvent,
          identity,
          workflowLog,
          debugWorkflow: DEBUG_WORKFLOW,
          runWorkspaceCommand,
          enableAutoRepair: ENABLE_POST_EDIT_AUTO_REPAIR,
          autoRepairCommand: POST_EDIT_AUTO_REPAIR_COMMAND,
          autoRepairTimeoutMs: POST_EDIT_AUTO_REPAIR_TIMEOUT_MS,
          maxExtraValidationRuns: POST_EDIT_AUTO_REPAIR_MAX_EXTRA_VALIDATION_RUNS,
        }).catch((err) => {
          if (DEBUG_ASSISTANT) log("Post-edit validation orchestration failed", err);
        });
      }
    },
    onToolError: (name, error) => {
      if (DEBUG_ASSISTANT) log(`Tool error: ${name}`, error);
    },
    onPause: (summary, pauseEditedFiles) => {
      if (DEBUG_ASSISTANT) log(`Agentic loop paused at step ${stepNumber}`, { summary, editedFiles: pauseEditedFiles });
    },
  });

  if (exploredFiles.length > 0) {
    onEvent({
      type: "context:explored",
      data: {
        files: exploredFiles,
        counts: { files: exploredFiles.length, functions: 0, tokens: 0 },
      },
    } as Parameters<OnStreamEvent>[0]);
  }

  if (result.paused && conversationId) {
    pausedLoopStates.set(conversationId, {
      state: result.paused,
      workspacePath,
      intentSummary,
      stepNumber,
    });

    onEvent({
      type: "step:awaiting_approval",
      data: {
        summary: result.paused.editSummary,
        editedFiles: result.paused.editedFiles,
        fileSnapshots: result.paused.fileSnapshots ?? [],
        stepNumber,
      },
    } as Parameters<OnStreamEvent>[0]);

    if (memKey) {
      recordTurnSummary(memKey, {
        userPrompt: prompt.slice(0, 200),
        toolsUsed,
        filesRead: exploredFiles,
        filesEdited: result.paused.editedFiles,
        responseSummary: `Step ${stepNumber}: ${result.paused.editSummary}`,
        toolCallCount: result.toolCallCount,
      });
    }

    const content = result.content || "";
    const estimatedTokens = Math.ceil(content.length / 4);
    return {
      intent: intentSummary,
      context: {
        files: [...exploredFiles, ...result.paused.editedFiles],
        functions: [],
        snippets: content ? [content] : [],
        estimatedTokens,
      },
      paused: true,
    };
  }

  if (conversationId) {
    pausedLoopStates.delete(conversationId);
  }

  if (memKey) {
    const responseSummary = (result.content || "").slice(0, 300);
    recordTurnSummary(memKey, {
      userPrompt: prompt.slice(0, 200),
      toolsUsed,
      filesRead: exploredFiles,
      filesEdited: editedFiles,
      responseSummary,
      toolCallCount: result.toolCallCount,
    });
  }

  const content = result.content || FALLBACK_NO_CONTEXT;
  const estimatedTokens = Math.ceil(content.length / 4);

  return {
    intent: intentSummary,
    context: {
      files: exploredFiles,
      functions: [],
      snippets: [content],
      estimatedTokens,
    },
  };
}

/**
 * Streaming variant of runAssistantPipeline.
 * Emits granular events via onEvent callback instead of returning a single result.
 */
export async function runAssistantStreamPipeline(
  prompt: string,
  workspacePath: string,
  onEvent: OnStreamEvent,
  identity: RequestIdentity,
  conversationId?: string,
  messages: Array<{ role: "user" | "assistant"; content: string }> = [],
  signal?: AbortSignal,
  chatMode: ChatMode = "agent",
): Promise<void> {
  ensureDbMemoryAdapter();
  const requestStart = Date.now();
  workflowLog("request:start", identity, { mode: chatMode });

  const lastMessages = messages.slice(-CHAT_HISTORY_LIMIT);
  const workspaceKey = workspacePath.replace(/\\/g, "/").replace(/\/$/, "");

  const memKey: SessionKey | null = conversationId
    ? { workspacePath, conversationId }
    : null;

  // Check for a paused agentic loop from a previous turn.
  // If one exists, the user is continuing a multi-step implementation.
  if (conversationId && pausedLoopStates.has(conversationId)) {
    const resumeState = pausedLoopStates.get(conversationId)!;
    pausedLoopStates.delete(conversationId);

    workflowLog("request:resume", identity, { step: resumeState.stepNumber, mode: chatMode });
    if (DEBUG_ASSISTANT) log("Resuming paused agentic loop", { conversationId, step: resumeState.stepNumber });

    onEvent({ type: "intent", data: resumeState.intentSummary });

    let historyForSeed =
      lastMessages.length > 0
        ? `${lastMessages
            .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n")}\nUser: ${prompt}`
        : prompt;
    if (memKey) {
      historyForSeed = injectMemoryIntoPrompt(historyForSeed, memKey);
    }

    const repo_id_resume = getRepoId(workspacePath);
    const gateStateResume = { analysisReady: false };
    const analysisPromiseResume = attachAnalysisGateForEdits(
      workspacePath,
      repo_id_resume,
      gateStateResume,
    );
    const resumeAnalysisWarmupStart = Date.now();
    // Resume path: skip STREAM_ANALYSIS_WARMUP_MS / withStreamKeepalivesDuring — the user is
    // continuing a paused session; do not delay the resumed agent loop with the same warmup
    // window used for a fresh agentic turn (analysis still runs in the background via
    // attachAnalysisGateForEdits, same as the main path).
    analysisPromiseResume
      .then((ran) => {
        if (ran) gateStateResume.analysisReady = true;
        workflowLog("analysis:background:complete", identity, {
          ran,
          elapsedMs: Date.now() - resumeAnalysisWarmupStart,
        });
      })
      .catch((err) => {
        workflowLog("analysis:background:error", identity, {
          message: err instanceof Error ? err.message : String(err),
        });
      });

    let retrievalEditGateResume:
      | { overall: number; threshold: number; schemaVersion?: string }
      | undefined;
    if (MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS > 0) {
      const seeded = await withAbort(
        seedRetrievalConfidenceForAgenticEditGate(
          repo_id_resume,
          historyForSeed,
          [],
          onEvent,
        ),
        signal,
      );
      retrievalEditGateResume = {
        overall: seeded.overall,
        threshold: MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS,
        ...(seeded.schemaVersion ? { schemaVersion: seeded.schemaVersion } : {}),
      };
    }

    const agenticResult = await withAbort(
      runAgenticStreamPath(
        prompt,
        lastMessages,
        workspacePath,
        onEvent,
        resumeState.intentSummary,
        identity,
        signal,
        conversationId,
        resumeState,
        gateStateResume,
        retrievalEditGateResume,
      ),
      signal,
    );

    onEvent({ type: "result", data: agenticResult });
    onEvent({ type: "done", data: {} });
    workflowLog("request:complete", identity, {
      latency_ms: Date.now() - requestStart,
      mode: chatMode,
    });
    return;
  }

  let historyAwarePrompt =
    lastMessages.length > 0
      ? `${lastMessages
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n")}\nUser: ${prompt}`
      : prompt;

  if (memKey) {
    historyAwarePrompt = injectMemoryIntoPrompt(historyAwarePrompt, memKey);
  }

  // 1. Intent classification
  workflowLog("intent:start", identity);
  const intentResult = await withAbort(
    runIntentPipeline(historyAwarePrompt, {
      cacheContext: {
        workspaceKey,
        conversationId,
        messages: lastMessages,
        contextHash: "",
      },
      skipReasoning: true,
      skipContextRequest: true,
    }),
    signal,
  );
  workflowLog("intent:complete", identity, { intent: intentResult.intent.intentType });

  const intentSummary = {
    intent: intentResult.response?.intent ?? intentResult.intent.intentType,
    summary: intentResult.response?.summary ?? intentResult.intent.intentType,
  };
  onEvent({ type: "intent", data: intentSummary });

  if (memKey) {
    recordIntent(
      memKey,
      intentSummary.intent,
      intentSummary.summary,
      intentResult.entities.entities.map((e) => e.value),
    );
  }

  // 2. Route: GENERIC intents with no context → fast direct LLM (no tools needed)
  const isGeneric = intentResult.intent.intentType === "GENERIC";
  if (isGeneric) {
    workflowLog("route:direct-llm", identity, { intent: intentResult.intent.intentType });
    if (DEBUG_ASSISTANT) log("Direct LLM response (GENERIC, no workspace tools)");
    const result = await withAbort(
      runDirectLLMStream(prompt, lastMessages, onEvent, identity, intentSummary),
      signal,
    );
    onEvent({ type: "result", data: result });
    onEvent({ type: "done", data: {} });
    workflowLog("request:complete", identity, {
      latency_ms: Date.now() - requestStart,
      mode: chatMode,
    });
    return;
  }

  // 3. All other intents: agentic loop (LLM-driven tool use).
  // The LLM decides which files to read, which patterns to search, etc.
  workflowLog("route:agentic", identity, { intent: intentSummary.intent });
  if (DEBUG_ASSISTANT) log("Agentic loop path for intent:", intentSummary.intent);

  // Kick off codebase analysis (for embedding index) with a short warmup window.
  const repo_id = getRepoId(workspacePath);
  workflowLog("analysis:warmup:start", identity, {
    repo_id,
    warmupMs: STREAM_ANALYSIS_WARMUP_MS,
  });
  const gateState = { analysisReady: false };
  const analysisPromise = attachAnalysisGateForEdits(workspacePath, repo_id, gateState);
  const warmupStart = Date.now();
  try {
    if (STREAM_ANALYSIS_WARMUP_MS > 0) {
      const warmupResult = await withStreamKeepalivesDuring(
        Promise.race([
          analysisPromise.then((ran) => ({ state: "analysis-ready" as const, ran })),
          sleepWithStreamKeepalives(STREAM_ANALYSIS_WARMUP_MS, onEvent, 1000, signal).then(
            () => ({ state: "warmup-timeout" as const, ran: false }),
          ),
        ]),
        onEvent,
        1500,
        signal,
      );
      workflowLog("analysis:warmup:complete", identity, warmupResult as unknown as Record<string, unknown>);
    }
  } catch (err) {
    workflowLog("analysis:warmup:error", identity, {
      message: err instanceof Error ? err.message : String(err),
    });
  }
  analysisPromise
    .then((ran) => {
      if (ran) gateState.analysisReady = true;
      workflowLog("analysis:background:complete", identity, {
        ran,
        elapsedMs: Date.now() - warmupStart,
      });
    })
    .catch((err) => {
      workflowLog("analysis:background:error", identity, {
        message: err instanceof Error ? err.message : String(err),
      });
    });

  if (ENABLE_STREAM_CONTEXT_PRIMER) {
    workflowLog("context-primer:start", identity);
    try {
      await withAbort(enrichContextWithFileContents(workspacePath, [], onEvent, signal), signal);
      workflowLog("context-primer:complete", identity);
    } catch (err) {
      workflowLog("context-primer:error", identity, {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let retrievalEditGate:
    | { overall: number; threshold: number; schemaVersion?: string }
    | undefined;
  if (MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS > 0) {
    const entityValues = intentResult.entities.entities.map((e) => e.value);
    const seeded = await withAbort(
      seedRetrievalConfidenceForAgenticEditGate(
        repo_id,
        historyAwarePrompt,
        entityValues,
        onEvent,
      ),
      signal,
    );
    retrievalEditGate = {
      overall: seeded.overall,
      threshold: MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS,
      ...(seeded.schemaVersion ? { schemaVersion: seeded.schemaVersion } : {}),
    };
  }

  workflowLog("agentic-loop:start", identity);
  const agenticResult = await withAbort(
    runAgenticStreamPath(
      prompt,
      lastMessages,
      workspacePath,
      onEvent,
      intentSummary,
      identity,
      signal,
      conversationId,
      undefined,
      gateState,
      retrievalEditGate,
    ),
    signal,
  );
  workflowLog("agentic-loop:complete", identity, { paused: Boolean(agenticResult.paused) });

  onEvent({ type: "result", data: agenticResult });
  onEvent({ type: "done", data: {} });
  workflowLog("request:complete", identity, {
    latency_ms: Date.now() - requestStart,
    mode: chatMode,
  });
}

export interface ContextDebugResult {
  intent: Record<string, unknown>;
  executionResult: Record<string, unknown>;
  contextWindow: Record<string, unknown>;
}

export async function runContextDebugPipeline(prompt: string): Promise<ContextDebugResult> {
  const intentResult = await runIntentPipeline(prompt);
  const adapter = (await getIntentAgentAdapter()) as unknown as ContextBuilderAdapter;
  const repo_id = "debug-repo";

  const plan = buildExecutionPlan(
    intentResult.intent.intentType,
    intentResult.entities.entities.map((entity) => entity.value),
  );
  log("Execution Plan:", plan);

  const result = await executePlan(plan, {
    repo_id,
    query: prompt,
    adapter,
  });
  result.logs.forEach((l) => log(l));

  return {
    intent: (intentResult.response ?? {
      intent: intentResult.intent.intentType,
      summary: intentResult.intent.intentType,
    }) as unknown as Record<string, unknown>,
    executionResult: result as unknown as Record<string, unknown>,
    contextWindow: (result.contextWindow ?? {}) as unknown as Record<string, unknown>,
  };
}
