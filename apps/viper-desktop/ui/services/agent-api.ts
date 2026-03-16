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
}

/** POST /chat — run assistant pipeline (intent + context ranking). Returns intent + context. */
export async function sendChat(prompt: string, workspacePath: string): Promise<ChatResponse> {
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, workspacePath }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Chat failed: ${res.status}`);
  }
  return res.json() as Promise<ChatResponse>;
}

/** Format assistant response for display in chat. */
export function formatChatResponse(data: ChatResponse): string {
  const lines: string[] = [];
  lines.push(`**Intent:** ${data.intent.intent}`);
  lines.push(`**Summary:** ${data.intent.summary}`);
  lines.push("");
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

export const EDIT_URL = "http://localhost:3000/editor/apply-change";

export async function applyEditorChange(payload: { file: string; change: string }) {
  await fetch(EDIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
