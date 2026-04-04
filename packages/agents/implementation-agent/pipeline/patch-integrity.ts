import { createHash } from "node:crypto";
import type { Patch, PatchOperation, FileChange } from "./implementation.types";

/** Deterministic JSON for hashing (object keys sorted; array order preserved). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

/** SHA-256 hex of the canonical patch JSON (preview ↔ apply integrity). */
export function hashPatch(patch: Patch): string {
  return createHash("sha256").update(stableStringify(patch), "utf8").digest("hex");
}

function opEquals(a: PatchOperation, b: PatchOperation): boolean {
  return (
    a.file === b.file &&
    a.type === b.type &&
    a.startLine === b.startLine &&
    a.endLine === b.endLine &&
    a.content === b.content &&
    a.expectedOldText === b.expectedOldText
  );
}

function changeEquals(a: FileChange, b: FileChange): boolean {
  return a.file === b.file && a.content === b.content;
}

/** True if every change/op in `partial` appears in `full` (per-file partial apply). */
export function isSubsetPatch(full: Patch, partial: Patch): boolean {
  for (const c of partial.changes) {
    if (!full.changes.some((fc) => changeEquals(fc, c))) {
      return false;
    }
  }
  for (const op of partial.operations) {
    if (!full.operations.some((fo) => opEquals(fo, op))) {
      return false;
    }
  }
  return true;
}

const PREVIEW_TTL_MS = 60 * 60 * 1000; // 1 hour

interface PreviewEntry {
  patchHash: string;
  patch: Patch;
  workspacePath: string;
  expiresAt: number;
}

const previews = new Map<string, PreviewEntry>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, e] of previews) {
    if (now > e.expiresAt) previews.delete(id);
  }
}

function getPreview(previewId: string): PreviewEntry | null {
  pruneExpired();
  const e = previews.get(previewId);
  if (!e || Date.now() > e.expiresAt) {
    previews.delete(previewId);
    return null;
  }
  return e;
}

/** Register a previewed patch on the server; returns `patchHash` (sha256 of patch). */
export function registerPatchPreview(
  previewId: string,
  patch: Patch,
  workspacePath: string,
): string {
  const patchHash = hashPatch(patch);
  previews.set(previewId, {
    patchHash,
    patch: structuredClone(patch),
    workspacePath,
    expiresAt: Date.now() + PREVIEW_TTL_MS,
  });
  return patchHash;
}

/**
 * Ensures the apply payload matches the preview:
 * - `patchHash` must match the stored preview hash (client echoes server preview).
 * - Incoming patch bytes must either equal the full preview patch hash, or be a strict subset
 *   of the stored patch (per-file apply).
 */
export function verifyPatchApplyOrThrow(
  incoming: Patch,
  previewId: string,
  clientPatchHash: string,
  workspacePath: string,
): void {
  const entry = getPreview(previewId);
  if (!entry) {
    throw new Error(
      "Patch preview expired or unknown — run the assistant again to generate a fresh preview.",
    );
  }
  if (entry.workspacePath !== workspacePath) {
    throw new Error("Workspace path does not match the previewed patch.");
  }
  if (clientPatchHash !== entry.patchHash) {
    throw new Error(
      "Patch hash mismatch — the apply request does not match the stored preview. Rejecting apply.",
    );
  }

  const incomingHash = hashPatch(incoming);
  if (incomingHash === entry.patchHash) {
    return;
  }
  if (isSubsetPatch(entry.patch, incoming)) {
    return;
  }
  throw new Error(
    "Patch hash mismatch — the patch to apply does not match the previewed patch. Rejecting apply.",
  );
}

/** Test helper: clear all previews. */
export function __resetPatchPreviewStoreForTests(): void {
  previews.clear();
}
