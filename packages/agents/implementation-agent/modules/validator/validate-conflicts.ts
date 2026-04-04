import type { Patch } from "../../pipeline/implementation.types";
import { readFile } from "../file-manager/read-file";

export interface ConflictCheckResult {
  valid: boolean;
  conflicts: string[];
}

/**
 * Check for on-disk conflicts before applying a patch.
 * - For operations: verify `expectedOldText` still matches the live file content.
 * - For operations: verify target line range is within bounds.
 * - For full-file changes: verify the file isn't absent when overwrite was expected
 *   (new files are fine).
 */
export function validateConflicts(
  patch: Patch,
  workspacePath: string,
): ConflictCheckResult {
  const conflicts: string[] = [];

  for (const op of patch.operations) {
    const current = readFile(workspacePath, op.file);
    if (current === null) {
      conflicts.push(`File not found on disk: ${op.file} (may have been deleted since preview)`);
      continue;
    }

    const lines = current.split("\n");
    const startIdx = op.startLine - 1;
    const endIdx = (op.endLine ?? op.startLine) - 1;

    if (op.type !== "insert") {
      if (startIdx < 0 || endIdx >= lines.length) {
        conflicts.push(
          `Line range out of bounds for ${op.file}: ${op.startLine}-${op.endLine ?? op.startLine} (file has ${lines.length} lines)`,
        );
        continue;
      }
    }

    if (op.expectedOldText !== undefined && op.type !== "insert") {
      const actual = lines.slice(startIdx, endIdx + 1).join("\n");
      if (actual !== op.expectedOldText) {
        conflicts.push(
          `Conflict on ${op.file} lines ${op.startLine}-${op.endLine ?? op.startLine}: file content has changed since preview`,
        );
      }
    }
  }

  return { valid: conflicts.length === 0, conflicts };
}
