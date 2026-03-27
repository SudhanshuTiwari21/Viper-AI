import { createHash, randomUUID } from "node:crypto";

export interface RequestIdentity {
  request_id: string;
  workspace_id: string;
  conversation_id: string | null;
}

/**
 * Normalize workspace path to a stable canonical form:
 * forward slashes, no trailing slash, lowercased on case-insensitive platforms.
 */
function normalizePath(workspacePath: string): string {
  let p = workspacePath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (process.platform === "win32" || process.platform === "darwin") {
    p = p.toLowerCase();
  }
  return p;
}

/**
 * Derive a deterministic, log-safe workspace identifier from a filesystem path.
 * Returns the first 16 hex characters of a SHA-256 hash of the normalized path.
 */
export function deriveWorkspaceId(workspacePath: string): string {
  const normalized = normalizePath(workspacePath);
  if (!normalized) return "0".repeat(16);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Create a fresh RequestIdentity for an incoming HTTP request.
 * - `request_id`: new UUIDv4 per call (one per HTTP request, never reused)
 * - `workspace_id`: deterministic hash of workspace path
 * - `conversation_id`: passed through from client, or null
 */
export function createRequestIdentity(
  workspacePath: string,
  conversationId?: string,
): RequestIdentity {
  return {
    request_id: randomUUID(),
    workspace_id: deriveWorkspaceId(workspacePath),
    conversation_id: conversationId ?? null,
  };
}
