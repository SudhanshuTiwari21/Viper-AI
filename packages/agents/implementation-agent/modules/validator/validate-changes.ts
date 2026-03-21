import type { Patch } from "../../pipeline/implementation.types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateChanges(patch: Patch): ValidationResult {
  const errors: string[] = [];

  if (patch.changes.length === 0) {
    errors.push("Patch contains no changes");
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

  return {
    valid: errors.length === 0,
    errors,
  };
}
