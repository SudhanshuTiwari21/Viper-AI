import type { MetadataJob } from "../types/metadata-job.types";
import type { SerializedASTNode } from "../types/metadata-job.types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Ensure AST metadata is valid before processing. If validation fails, log and skip job.
 */
export function validateMetadataJob(job: unknown): ValidationResult {
  const errors: string[] = [];

  if (!job || typeof job !== "object") {
    return { valid: false, errors: ["Job is not an object"] };
  }

  const j = job as Record<string, unknown>;

  if (!j.repo_id || typeof j.repo_id !== "string") {
    errors.push("missing or invalid repo_id");
  }
  if (!j.file || typeof j.file !== "string") {
    errors.push("missing or invalid file");
  }
  if (!j.ast) {
    errors.push("missing ast");
  } else {
    const astErrors = validateASTStructure(j.ast);
    errors.push(...astErrors);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [] };
}

/**
 * Check AST for invalid structure, missing function names, duplicate nodes (by name+start).
 */
function validateASTStructure(ast: unknown): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  function visit(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const n = node as SerializedASTNode;
    if (!n.type || typeof n.type !== "string") {
      errors.push("node missing type");
      return;
    }
    const key = `${n.type}:${n.name ?? ""}:${n.start ?? 0}`;
    if (seen.has(key)) {
      errors.push("duplicate node");
    }
    seen.add(key);
    if (
      (n.type === "function_declaration" || n.type === "FunctionDeclaration") &&
      (!n.name || typeof n.name !== "string")
    ) {
      errors.push("function node missing name");
    }
    if (n.children && Array.isArray(n.children)) {
      for (const c of n.children) visit(c);
    }
  }

  if (Array.isArray(ast)) {
    for (const item of ast) visit(item);
  } else {
    visit(ast);
  }
  return errors;
}
