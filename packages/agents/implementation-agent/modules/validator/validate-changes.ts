import type { Patch } from "../../pipeline/implementation.types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateChanges(patch: Patch): ValidationResult {
  const errors: string[] = [];

  if (patch.changes.length === 0 && patch.operations.length === 0) {
    errors.push("Patch contains no changes or operations");
  }

  for (const change of patch.changes) {
    if (!change.file || change.file.trim().length === 0) {
      errors.push("Change has empty file path");
    }
    if (!change.content || change.content.trim().length === 0) {
      errors.push(`File ${change.file} has empty content`);
    }
    if (change.file.includes("..")) {
      errors.push(`File ${change.file} contains path traversal`);
    }
  }

  for (const op of patch.operations) {
    if (!op.file || op.file.trim().length === 0) {
      errors.push("Operation has empty file path");
    }
    if (op.file.includes("..")) {
      errors.push(`Operation file ${op.file} contains path traversal`);
    }
    if (op.startLine <= 0) {
      errors.push(`Operation on ${op.file} has invalid startLine`);
    }
    if (op.type !== "insert" && (op.endLine === undefined || op.endLine < op.startLine)) {
      errors.push(`Operation ${op.type} on ${op.file} has invalid range`);
    }
    if ((op.type === "insert" || op.type === "replace") && typeof op.content !== "string") {
      errors.push(`Operation ${op.type} on ${op.file} missing content`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
