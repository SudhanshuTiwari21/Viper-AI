/**
 * Viper AI Backend (orchestrator) API.
 * Backend runs at port 4000 and wires Intent Agent, Context Builder, and Context Ranking.
 */

const BACKEND_URL =
  (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_AGENT_API_URL?: string } }).env?.VITE_AGENT_API_URL) ||
  "http://localhost:4000";

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
}

/** POST /chat — run assistant pipeline (intent + context ranking). Returns intent + context. */
export async function sendChat(
  prompt: string,
  workspacePath: string,
  conversationId?: string,
  messages?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<ChatResponse> {
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, workspacePath, conversationId, messages }),
    signal: AbortSignal.timeout(120_000),
  });
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
): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, workspacePath, conversationId, messages }),
    signal: signal ?? AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Chat failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
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

/** Format assistant response for display in chat. */
export function formatChatResponse(data: ChatResponse): string {
  const lines: string[] = [];
  lines.push(`**Intent:** ${data.intent.intent}`);
  lines.push(`**Summary:** ${data.intent.summary}`);
  lines.push("");

  if (data.reasoning && (data.reasoning.detectedComponents?.length || data.reasoning.missingComponents?.length || data.reasoning.potentialIssues?.length || data.reasoning.recommendedNextStep)) {
    if (data.reasoning.detectedComponents?.length) {
      lines.push("**What's in place:**");
      data.reasoning.detectedComponents.forEach((c) => lines.push(`- ${c}`));
      lines.push("");
    }
    if (data.reasoning.missingComponents?.length) {
      lines.push("**What needs to be done:**");
      data.reasoning.missingComponents.forEach((c) => lines.push(`- ${c}`));
      lines.push("");
    }
    if (data.reasoning.potentialIssues?.length) {
      lines.push("**Potential issues:**");
      data.reasoning.potentialIssues.forEach((c) => lines.push(`- ${c}`));
      lines.push("");
    }
    if (data.reasoning.recommendedNextStep) {
      lines.push(`**Suggested next step:** ${data.reasoning.recommendedNextStep}`);
      lines.push("");
    }
  }

  lines.push(`**Context** (${data.context.estimatedTokens} tokens):`);
  if (data.context.files.length) {
    lines.push(`Files: ${data.context.files.join(", ")}`);
  }
  if (data.context.functions.length) {
    lines.push(`Functions: ${data.context.functions.join(", ")}`);
  }
  if (data.context.snippets.length) {
    lines.push("");
    lines.push("Snippets:");
    data.context.snippets.forEach((s, i) => {
      lines.push(`--- ${i + 1} ---`);
      lines.push(s);
    });
  }
  return lines.join("\n");
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

export const EDIT_URL = "http://localhost:3000/editor/apply-change";

export async function applyEditorChange(payload: { file: string; change: string }) {
  await fetch(EDIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
