/**
 * Viper AI Backend (orchestrator) API.
 * Backend runs at port 4000 and wires Intent Agent, Context Builder, and Context Ranking.
 */

const BACKEND_URL =
  (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_AGENT_API_URL?: string } }).env?.VITE_AGENT_API_URL) ||
  "http://localhost:4000";

export {
  buildV2rayTunSubscriptionImportDeepLink,
  normalizeSubscriptionUrlForRemoteFetch,
} from "../lib/v2raytun-deeplink";

/** Chromium/Electron surfaces dropped SSE/TCP as "Failed to fetch" — explain what that usually means. */
function humanizeNetworkError(err: unknown): Error {
  if (!(err instanceof Error)) return new Error("Request failed");
  const m = err.message;
  if (m === "Failed to fetch" || m.includes("NetworkError") || m.includes("Load failed")) {
    return new Error(
      [
        `Connection to ${BACKEND_URL} dropped mid-stream (Failed to fetch).`,
        `Common causes: two chats at once, closing the window, Wi‑Fi sleep, or the browser idling out a long silent phase (backend may still log work—check the terminal).`,
        `Wait for one reply to finish; one window; keep the backend running; try http://127.0.0.1:4000 if localhost is flaky.`,
      ].join(" "),
    );
  }
  if (err.name === "AbortError" || m.toLowerCase().includes("timeout")) {
    return new Error("Request timed out. The assistant may still be working — try again.");
  }
  return err;
}

export interface ChatResponse {
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
  /** Short LLM recap of the proposed patch (preferred over raw JSON / reflection dumps). */
  proposalSummary?: string;
}

export type ChatMode = "ask" | "plan" | "debug" | "agent";

/** D.19: per-request model tier (matches backend `modelTier`). */
export type ModelTier = "auto" | "premium";

// ---------------------------------------------------------------------------
// E.25 — Image attachment types (mirrors E.22 backend schema)
// ---------------------------------------------------------------------------

/** Subset of E.22 INLINE_IMAGE_MIME_ALLOWLIST used for client-side pre-validation. */
export const ATTACHMENT_MIME_ALLOWLIST = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AttachmentMimeType = (typeof ATTACHMENT_MIME_ALLOWLIST)[number];

/** E.22/E.23 media_ref attachment shape sent to /chat and /chat/stream. */
export interface MediaRefAttachment {
  kind: "image";
  source: { type: "media_ref"; mediaId: string };
}

/** Response from POST /media/upload. */
export interface MediaUploadResponse {
  mediaId: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
}

/** Max bytes per file — must match E.22/E.23 INLINE_IMAGE_MAX_BYTES (6 MiB). */
export const ATTACHMENT_MAX_BYTES = 6 * 1024 * 1024;
/** Max number of attachments per send — must match E.22 ATTACHMENT_MAX_COUNT. */
export const ATTACHMENT_MAX_COUNT = 8;

// ---------------------------------------------------------------------------
// E.25 — Upload a single image file to /media/upload
// ---------------------------------------------------------------------------

/**
 * Upload a single image file (File or Blob) to POST /media/upload.
 *
 * The workspace_id MUST be derived with deriveWorkspaceId(workspacePath) so
 * it matches the value the backend uses when resolving E.22 media_ref
 * attachments in E.24.
 *
 * Client-side validation (MIME allowlist + 6 MiB cap) is performed before the
 * request — matching the E.22/E.23 server-side limits — to give immediate
 * feedback without a round-trip.
 *
 * @throws Error with a user-readable message on validation or network failure.
 */
export async function uploadChatMedia(params: {
  workspaceId: string;
  file: File | Blob;
  /** Explicit MIME type. Falls back to file.type when omitted. */
  mimeType?: string;
}): Promise<MediaUploadResponse> {
  const { workspaceId, file } = params;

  // Resolve MIME: explicit override → File.type → extension sniff
  const rawMime = params.mimeType ?? (file instanceof File ? file.type : "");
  const mimeType = resolveMimeType(rawMime, file instanceof File ? file.name : "");

  if (!ATTACHMENT_MIME_ALLOWLIST.includes(mimeType as AttachmentMimeType)) {
    throw new Error(
      `Unsupported image type: "${mimeType}". ` +
        `Allowed: ${ATTACHMENT_MIME_ALLOWLIST.join(", ")}.`,
    );
  }

  if (file.size > ATTACHMENT_MAX_BYTES) {
    const mib = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Image is too large (${mib} MiB). Maximum allowed size is 6 MiB per file.`,
    );
  }

  // Read file → base64
  const arrayBuffer = await file.arrayBuffer();
  const dataBase64 = arrayBufferToBase64(arrayBuffer);

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/media/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId, mimeType, dataBase64 }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw humanizeNetworkError(e);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Upload failed: ${res.status}`);
  }
  return res.json() as Promise<MediaUploadResponse>;
}

/** Convert an ArrayBuffer to a base64 string without the data-URL prefix. */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Resolve MIME from a type string + optional filename extension fallback. */
function resolveMimeType(type: string, filename: string): string {
  if (type && type !== "application/octet-stream") return type;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const EXT_MAP: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };
  return EXT_MAP[ext] ?? type;
}

/** POST /chat — run assistant pipeline (intent + context ranking). Returns intent + context. */
export async function sendChat(
  prompt: string,
  workspacePath: string,
  conversationId?: string,
  messages?: Array<{ role: "user" | "assistant"; content: string }>,
  mode?: ChatMode,
  modelTier: ModelTier = "auto",
  premiumModelId?: string,
  attachments?: MediaRefAttachment[],
): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        workspacePath,
        conversationId,
        messages,
        ...(mode ? { mode } : {}),
        modelTier,
        ...(modelTier === "premium" && premiumModelId ? { premiumModelId } : {}),
        // E.25: only include attachments key when non-empty (backward compat)
        ...(attachments?.length ? { attachments } : {}),
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw humanizeNetworkError(e);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Chat failed: ${res.status}`);
  }
  return res.json() as Promise<ChatResponse>;
}

export interface StreamEventPayload {
  type: string;
  data: Record<string, unknown>;
}

/**
 * POST /chat/stream — SSE streaming.
 * Calls onEvent for each SSE event as it arrives (intent, plan, step:start, token, result, done, etc.).
 * Resolves when the stream closes.
 */
export async function sendChatStream(
  prompt: string,
  workspacePath: string,
  onEvent: (event: StreamEventPayload) => void,
  conversationId?: string,
  messages?: Array<{ role: "user" | "assistant"; content: string }>,
  signal?: AbortSignal,
  mode?: ChatMode,
  modelTier: ModelTier = "auto",
  premiumModelId?: string,
  /** E.25: validated media_ref attachments to include in the request body. */
  attachments?: MediaRefAttachment[],
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        workspacePath,
        conversationId,
        messages,
        ...(mode ? { mode } : {}),
        modelTier,
        ...(modelTier === "premium" && premiumModelId ? { premiumModelId } : {}),
        // E.25: only include attachments key when non-empty (backward compat)
        ...(attachments?.length ? { attachments } : {}),
      }),
      signal: signal ?? AbortSignal.timeout(300_000),
    });
  } catch (e) {
    throw humanizeNetworkError(e);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Chat failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (e) {
      throw humanizeNetworkError(e);
    }
    const { done, value } = chunk;
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part.split("\n").map((l) => l.trim()).filter(Boolean);
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;

      const eventType = eventLine.slice("event:".length).trim();
      const dataStr = dataLine.slice("data:".length).trim();

      try {
        const data = JSON.parse(dataStr) as Record<string, unknown>;
        onEvent({ type: eventType, data });
      } catch {
        onEvent({ type: eventType, data: { raw: dataStr } });
      }
    }
  }
}

/**
 * Strip markdown / noisy punctuation so chat reads like plain prose (no **, bullets as ASCII art, etc.).
 * Exported for use in the chat UI on streamed or final text.
 */
export function stripMarkdownForChat(s: string): string {
  let t = s.trim();
  if (!t) return t;

  // Unwrap **bold** and *italic* repeatedly (handles nested-ish cases)
  for (let i = 0; i < 10; i++) {
    const next = t
      .replace(/\*\*((?:[^*]|\*(?!\*))+?)\*\*/g, "$1")
      .replace(/(?<!\*)\*((?:[^*\n])+?)\*(?!\*)/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_\n]+)_/g, "$1");
    if (next === t) break;
    t = next;
  }

  // Any leftover emphasis markers
  t = t.replace(/\*\*/g, "");
  t = t.replace(/\*/g, "");

  // ATX headings
  t = t.replace(/^#{1,6}\s+/gm, "");

  // Horizontal rules
  t = t.replace(/^---+$/gm, "");

  // Inline code ticks
  t = t.replace(/`([^`]+)`/g, "$1");

  // Markdown bullets → simple bullet character
  t = t.replace(/^(\s*)[-*+]\s+/gm, "$1• ");

  // Collapse excessive blank lines / spaces
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

/** @deprecated use stripMarkdownForChat */
function stripInlineMarkdownNoise(s: string): string {
  return stripMarkdownForChat(s);
}

/** Matches backend `FALLBACK_NO_CONTEXT`. */
const FALLBACK_SNIPPET = "No relevant code found in repository.";

function humanizeIntentName(intent: string): string {
  return intent.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Intent classifier + memory sometimes produce huge “Entities: a,b,c,…” strings — never show raw. */
function isGarbageIntentSummary(summary: string): boolean {
  const t = summary.trim();
  if (t.length < 120) return false;
  if (/Entities:\s*/i.test(t) && t.length > 200) return true;
  if (t.split(/\s+/).length > 70) return true;
  return false;
}

function hasReasoningBlocks(r?: ChatResponse["reasoning"]): boolean {
  if (!r) return false;
  return (
    Boolean(r.recommendedNextStep?.trim()) ||
    (r.detectedComponents?.length ?? 0) > 0 ||
    (r.missingComponents?.length ?? 0) > 0 ||
    (r.potentialIssues?.length ?? 0) > 0
  );
}

/** Direct LLM stream: one prose answer — show only the reply (incl. PROJECT_SETUP with retrieved file paths). */
function isDirectStreamingAnswer(data: ChatResponse): boolean {
  if (data.proposalSummary?.trim()) return false;
  if (hasReasoningBlocks(data.reasoning)) return false;
  const snips = data.context.snippets;
  if (snips.length !== 1) return false;
  const s = snips[0]?.trim() ?? "";
  if (!s || s === FALLBACK_SNIPPET) return false;
  if (
    data.intent.intent === "PROJECT_SETUP" ||
    data.intent.intent === "CODE_GUIDANCE" ||
    data.intent.intent === "GENERIC"
  ) {
    return true;
  }
  return data.context.files.length === 0 && data.context.functions.length === 0;
}

/**
 * Format assistant response for display in chat.
 * When a patch was proposed (`proposalSummary`), show only human copy + files — no intent taxonomy or reasoning dumps.
 */
export function formatChatResponse(data: ChatResponse): string {
  if (data.proposalSummary?.trim()) {
    const body = stripInlineMarkdownNoise(data.proposalSummary.trim());
    const lines: string[] = [body];
    const files = [...new Set(data.context.files.filter(Boolean))];
    if (files.length) {
      lines.push("");
      lines.push(`Files: ${files.join(", ")}`);
    }
    return lines.join("\n");
  }

  if (isDirectStreamingAnswer(data)) {
    return stripInlineMarkdownNoise(data.context.snippets[0] ?? "");
  }

  const lines: string[] = [];

  const summary = data.intent.summary?.trim() ?? "";
  if (summary && !isGarbageIntentSummary(summary)) {
    lines.push(summary);
  } else {
    lines.push(`Answering in context of ${humanizeIntentName(data.intent.intent)}.`);
  }
  lines.push("");

  if (hasReasoningBlocks(data.reasoning) && data.reasoning) {
    const r = data.reasoning;
    if (r.detectedComponents?.length) {
      lines.push("In the codebase:");
      r.detectedComponents.forEach((c) => lines.push(`- ${c}`));
      lines.push("");
    }
    if (r.missingComponents?.length) {
      lines.push("Gaps:");
      r.missingComponents.forEach((c) => lines.push(`- ${c}`));
      lines.push("");
    }
    if (r.potentialIssues?.length) {
      lines.push("Watch outs:");
      r.potentialIssues.forEach((c) => lines.push(`- ${c}`));
      lines.push("");
    }
    if (r.recommendedNextStep) {
      lines.push(`Next step: ${r.recommendedNextStep}`);
      lines.push("");
    }
  }

  const onlyFallback =
    data.context.snippets.length === 1 &&
    data.context.snippets[0]?.trim() === FALLBACK_SNIPPET &&
    data.context.files.length === 0;

  if (onlyFallback && !hasReasoningBlocks(data.reasoning)) {
    lines.push(
      "No indexed code matched this query yet. Try running codebase analysis, or ask a general question (setup, commands, concepts).",
    );
    return stripMarkdownForChat(lines.join("\n").trim());
  }

  if (data.context.files.length || data.context.functions.length) {
    lines.push(
      `Referenced context (${data.context.estimatedTokens} tokens):`,
    );
    if (data.context.files.length) {
      lines.push(`Files: ${data.context.files.join(", ")}`);
    }
    if (data.context.functions.length) {
      lines.push(`Functions: ${data.context.functions.join(", ")}`);
    }
    lines.push("");
  }

  if (data.context.snippets.length && !onlyFallback) {
    lines.push("Snippets:");
    data.context.snippets.forEach((s, i) => {
      lines.push(`--- ${i + 1} ---`);
      lines.push(s);
    });
  }

  return stripMarkdownForChat(lines.join("\n").trim());
}

/** POST /analysis/scan — run Repo Scanner only; returns files, sourceFiles, jobs (for testing with IDE workspace). */
export interface AnalysisScanResult {
  workspacePath: string;
  repo_id: string;
  files: Array<{ file: string; language: string; module: string; type: string }>;
  sourceFiles: Array<{ file: string; language: string; module: string }>;
  jobs: Array<{ repo: string; file: string; language: string; module: string }>;
}

export async function runAnalysisScan(workspacePath: string): Promise<AnalysisScanResult> {
  const res = await fetch(`${BACKEND_URL}/analysis/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspacePath }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Scan failed: ${res.status}`);
  }
  return res.json() as Promise<AnalysisScanResult>;
}

/** Format scan result for display (how the codebase-analysis-agent understands the workspace). */
export function formatScanReport(data: AnalysisScanResult): string {
  const lines: string[] = [];
  lines.push("## Codebase scan (Repo Scanner)");
  lines.push("");
  lines.push(`**Workspace:** \`${data.workspacePath}\``);
  lines.push(`**Repo ID:** \`${data.repo_id}\``);
  lines.push("");
  lines.push(`**Total files:** ${data.files.length}`);
  lines.push(`**Source files (for AST):** ${data.sourceFiles.length}`);
  lines.push(`**Parse jobs:** ${data.jobs.length}`);
  lines.push("");
  const modules = [...new Set(data.files.map((f) => f.module))].sort();
  lines.push(`**Modules:** ${modules.join(", ") || "(none)"}`);
  lines.push("");
  lines.push("### Sample files (language, module, type)");
  data.files.slice(0, 25).forEach((f) => {
    lines.push(`- \`${f.file}\` — ${f.language}, module: \`${f.module}\`, type: ${f.type}`);
  });
  if (data.files.length > 25) {
    lines.push(`- … and ${data.files.length - 25} more`);
  }
  lines.push("");
  lines.push("### Sample parse jobs (source files → AST)");
  data.jobs.slice(0, 15).forEach((j) => {
    lines.push(`- \`${j.file}\` (${j.language}, \`${j.module}\`)`);
  });
  if (data.jobs.length > 15) {
    lines.push(`- … and ${data.jobs.length - 15} more`);
  }
  return lines.join("\n");
}

/** POST /analysis/run — trigger codebase analysis (scanner, AST, metadata, graph, embeddings). */
export async function runAnalysis(workspacePath: string): Promise<{ status: string }> {
  const res = await fetch(`${BACKEND_URL}/analysis/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspacePath }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Analysis failed: ${res.status}`);
  }
  return res.json() as Promise<{ status: string }>;
}

/** GET /health — check if backend is up. */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** POST /patch/apply — apply a previously previewed patch (previewId + patchHash required). */
export async function applyPatch(
  workspacePath: string,
  patch: { changes: unknown[]; operations: unknown[] },
  previewId: string,
  patchHash: string,
): Promise<{ success: boolean; rollbackId?: string; logs: string[] }> {
  const res = await fetch(`${BACKEND_URL}/patch/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspacePath, previewId, patchHash, patch }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Patch apply failed: ${res.status}`);
  }
  return res.json() as Promise<{ success: boolean; rollbackId?: string; logs: string[] }>;
}

/** POST /patch/reject — reject a previewed patch (no-op on backend). */
export async function rejectPatch(): Promise<void> {
  await fetch(`${BACKEND_URL}/patch/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(5_000),
  });
}

/** POST /patch/rollback — undo a previously applied patch. */
export async function rollbackPatch(
  workspacePath: string,
  rollbackId: string,
): Promise<{ success: boolean; logs: string[] }> {
  const res = await fetch(`${BACKEND_URL}/patch/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspacePath, rollbackId }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Rollback failed: ${res.status}`);
  }
  return res.json() as Promise<{ success: boolean; logs: string[] }>;
}

/** D.21: submit feedback for an assistant message. */
export type FeedbackRating = "up" | "down";

export async function sendFeedback(params: {
  request_id: string;
  message_id?: string;
  rating: FeedbackRating;
  tags?: string[];
  comment?: string;
  workspace_id: string;
}): Promise<void> {
  try {
    const res = await fetch(`${BACKEND_URL}/chat/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      console.warn("[Viper] Feedback failed:", (err as { error?: string }).error);
    }
  } catch (e) {
    console.warn("[Viper] Feedback request failed:", e);
  }
}

// ---------------------------------------------------------------------------
// F.35 — Usage & plan summary
// ---------------------------------------------------------------------------

export interface UsageSummaryEntitlements {
  allowed_modes: string[] | null;
  allowed_model_tiers: string[] | null;
  flags: Record<string, unknown>;
}

export interface UsageSummaryStripe {
  customerId: string;
  subscriptionId: string | null;
}

export interface UsageSummaryResponse {
  pathKey: string;
  month: { firstDay: string; lastDay: string };
  /** Decimal string (BigInt serialised) */
  usedRequests: string;
  /** Decimal string or null when unlimited */
  limit: string | null;
  /** Decimal string or null when unlimited */
  remaining: string | null;
  entitlements: UsageSummaryEntitlements;
  stripe: UsageSummaryStripe | null;
}

/**
 * Fetch usage & plan summary for the current workspace.
 * Returns null when the endpoint is disabled (404) or when the request fails
 * so the UI can degrade gracefully without blocking chat.
 */
export async function fetchUsageSummary(
  workspacePath: string,
): Promise<UsageSummaryResponse | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/usage/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspacePath }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) {
      // VIPER_USAGE_UI_ENABLED not set — graceful null
      return null;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw humanizeNetworkError(
        new Error((err as { error?: string }).error ?? `Usage summary failed: ${res.status}`),
      );
    }
    return (await res.json()) as UsageSummaryResponse;
  } catch (err) {
    throw humanizeNetworkError(err);
  }
}

// ---------------------------------------------------------------------------
// G.36 — Inline completion
// ---------------------------------------------------------------------------

export interface InlineCompletionPayload {
  workspacePath: string;
  filePath: string;
  languageId: string;
  textBeforeCursor: string;
  textAfterCursor?: string;
  cursorLine: number;
  cursorColumn: number;
}

export interface InlineCompletionResult {
  /** Suggested text to insert at the cursor. Empty string = no suggestion. */
  text: string;
}

/**
 * Fetch a single inline ghost-text completion from the backend.
 * Returns `{ text: "" }` on any error (404 disabled, network failure, etc.)
 * so the Monaco provider can degrade silently.
 */
export async function fetchInlineCompletion(
  payload: InlineCompletionPayload,
  signal?: AbortSignal,
): Promise<InlineCompletionResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/editor/inline-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: signal ?? AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      // 404 = endpoint disabled; other errors are transient — both return empty
      return { text: "" };
    }
    return (await res.json()) as InlineCompletionResult;
  } catch {
    // AbortError (user typed again), network errors → silent empty
    return { text: "" };
  }
}

// ---------------------------------------------------------------------------
// G.37 — Inline edit (AI-powered in-file edits)
// ---------------------------------------------------------------------------

export interface InlineEditSelection {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface InlineEditPayload {
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

/**
 * Request an AI-powered in-file edit from the backend.
 * Returns the full modified file content, which feeds into the PendingEdit →
 * MonacoDiffEditor Accept/Reject flow.
 *
 * Unlike inline completion, errors are propagated (user-initiated action).
 */
export async function fetchInlineEdit(
  payload: InlineEditPayload,
  signal?: AbortSignal,
): Promise<InlineEditResult> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/editor/inline-edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: signal ?? AbortSignal.timeout(35_000),
    });
  } catch (e) {
    throw humanizeNetworkError(e);
  }

  if (res.status === 404) {
    throw new Error("AI edit is not enabled on the backend (VIPER_INLINE_EDIT_ENABLED).");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Inline edit failed: ${res.status}`);
  }
  return (await res.json()) as InlineEditResult;
}

// ---------------------------------------------------------------------------
// G.38 — Git commit / PR assistant
// ---------------------------------------------------------------------------

export type CommitStyle = "conventional" | "short";

export interface SuggestCommitPayload {
  workspacePath: string;
  branch?: string;
  stagedDiff: string;
  style?: CommitStyle;
}

export interface CommitSuggestionResult {
  subject: string;
  body?: string;
}

export interface SuggestPrPayload {
  workspacePath: string;
  branch?: string;
  stagedDiff: string;
}

export interface PrSuggestionResult {
  title: string;
  body: string;
}

/**
 * Request an AI-generated commit message for the current staged diff.
 * Throws on network failure or backend error (user-initiated).
 */
export async function fetchSuggestCommitMessage(
  payload: SuggestCommitPayload,
): Promise<CommitSuggestionResult> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/git/suggest-commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw humanizeNetworkError(e);
  }

  if (res.status === 404) {
    throw new Error(
      "AI commit assistant is not enabled on the backend (VIPER_COMMIT_ASSISTANT_ENABLED).",
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (err as { error?: string }).error ?? `Suggest commit failed: ${res.status}`,
    );
  }
  return (await res.json()) as CommitSuggestionResult;
}

/**
 * Request an AI-generated PR title + markdown body for the current staged diff.
 * Throws on network failure or backend error.
 */
export async function fetchSuggestPrBody(
  payload: SuggestPrPayload,
): Promise<PrSuggestionResult> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/git/suggest-pr-body`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw humanizeNetworkError(e);
  }

  if (res.status === 404) {
    throw new Error(
      "AI PR assistant is not enabled on the backend (VIPER_COMMIT_ASSISTANT_ENABLED).",
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (err as { error?: string }).error ?? `Suggest PR failed: ${res.status}`,
    );
  }
  return (await res.json()) as PrSuggestionResult;
}

// ---------------------------------------------------------------------------
// G.39 — Test assistant
// ---------------------------------------------------------------------------

export interface TestCommand {
  cwd?: string;
  shell: string;
  rationale: string;
}

export interface SuggestTestCommandsPayload {
  workspacePath: string;
  changedFiles: string[];
  packageHint?: "backend" | "database" | "desktop" | "auto";
}

export interface SuggestTestCommandsResult {
  commands: TestCommand[];
}

export interface TriageFailurePayload {
  workspacePath: string;
  runnerOutput: string;
  runner?: "vitest" | "jest" | "unknown";
}

export interface TriageFailureResult {
  summary: string;
  bullets: string[];
  suggestedCommands: string[];
}

export async function fetchSuggestTestCommands(
  payload: SuggestTestCommandsPayload,
): Promise<SuggestTestCommandsResult> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/testing/suggest-commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw humanizeNetworkError(e);
  }

  if (res.status === 404) {
    throw new Error(
      "Test assistant is not enabled on the backend (VIPER_TEST_ASSISTANT_ENABLED).",
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (err as { error?: string }).error ?? `Suggest test commands failed: ${res.status}`,
    );
  }
  return (await res.json()) as SuggestTestCommandsResult;
}

export async function fetchTriageFailure(
  payload: TriageFailurePayload,
): Promise<TriageFailureResult> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/testing/triage-failure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw humanizeNetworkError(e);
  }

  if (res.status === 404) {
    throw new Error(
      "Test assistant is not enabled on the backend (VIPER_TEST_ASSISTANT_ENABLED).",
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (err as { error?: string }).error ?? `Triage failed: ${res.status}`,
    );
  }
  return (await res.json()) as TriageFailureResult;
}

export const EDIT_URL = "http://localhost:3000/editor/apply-change";

export async function applyEditorChange(payload: { file: string; change: string }) {
  await fetch(EDIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
