import type { HunkApprovalStatus } from "../components/inline-diff-viewer";
import {
  buildFileDiffWithHunks,
  applySelectedHunks,
} from "./hunk-model";

export interface FilteredPatchResult {
  /** Patch containing only approved hunks (full-file change entries rebuilt from accepted hunks). */
  patch: { changes: Array<{ file: string; content: string }>; operations: unknown[] };
  appliedFiles: number;
  skippedFiles: number;
}

/**
 * Given the original preview patch, diffs, and hunk statuses, compute a patch
 * that only writes the hunks the user approved.
 *
 * For each file:
 * - If ALL hunks approved → include original change/operations as-is.
 * - If SOME hunks approved → rebuild `after` from accepted hunks only
 *   and emit a single `change` entry (full-file replace). Operations are dropped
 *   because hunk-level partial applies can't use line-based ops safely.
 * - If NO hunks approved → skip the file entirely.
 */
export function filterPatchByHunks(
  patch: { changes: unknown[]; operations: unknown[] },
  diffs: Array<{ file: string; before: string; after: string }>,
  hunkStatuses: Record<string, HunkApprovalStatus>,
): FilteredPatchResult {
  const changes: Array<{ file: string; content: string }> = [];
  let appliedFiles = 0;
  let skippedFiles = 0;

  const filesInPatch = new Set<string>();
  for (const c of patch.changes as Array<{ file: string }>) filesInPatch.add(c.file);
  for (const o of patch.operations as Array<{ file: string }>) filesInPatch.add(o.file);

  for (const file of filesInPatch) {
    const diff = diffs.find((d) => d.file === file);
    if (!diff) {
      skippedFiles++;
      continue;
    }

    const fdh = buildFileDiffWithHunks(diff);
    if (fdh.hunks.length === 0) {
      skippedFiles++;
      continue;
    }

    const approved = fdh.hunks.filter(
      (h) => (hunkStatuses[h.id] ?? "approved") === "approved",
    );
    const rejected = fdh.hunks.filter(
      (h) => (hunkStatuses[h.id] ?? "approved") === "rejected",
    );

    if (approved.length === 0) {
      skippedFiles++;
      continue;
    }

    appliedFiles++;

    if (rejected.length === 0) {
      const origChange = (patch.changes as Array<{ file: string; content: string }>).find(
        (c) => c.file === file,
      );
      if (origChange) {
        changes.push(origChange);
      } else {
        changes.push({ file, content: diff.after });
      }
    } else {
      const acceptedIds = new Set(approved.map((h) => h.id));
      const content = applySelectedHunks(diff.before, diff.after, acceptedIds, file);
      changes.push({ file, content });
    }
  }

  return { patch: { changes, operations: [] }, appliedFiles, skippedFiles };
}

/** Build initial hunk statuses with all hunks approved by default. */
export function buildInitialHunkStatuses(
  diffs: Array<{ file: string; before: string; after: string }>,
): Record<string, HunkApprovalStatus> {
  const out: Record<string, HunkApprovalStatus> = {};
  for (const diff of diffs) {
    const fdh = buildFileDiffWithHunks(diff);
    for (const h of fdh.hunks) {
      out[h.id] = "approved";
    }
  }
  return out;
}
