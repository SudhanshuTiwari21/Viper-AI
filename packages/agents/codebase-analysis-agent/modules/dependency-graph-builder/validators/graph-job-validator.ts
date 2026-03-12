import type { GraphBuildJob } from "../types/graph-job.types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate incoming graph build event. Invalid job → log + skip.
 */
export function validateGraphBuildJob(payload: unknown): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["Payload is not an object"] };
  }

  const job = payload as Record<string, unknown>;

  if (!job.repo_id || typeof job.repo_id !== "string") {
    errors.push("missing or invalid repo_id");
  }
  if (!job.file || typeof job.file !== "string") {
    errors.push("missing or invalid file");
  }
  if (job.module != null && typeof job.module !== "string") {
    errors.push("invalid module");
  }

  const edges = job.edges ?? job.relationships;
  if (edges != null && !Array.isArray(edges)) {
    errors.push("edges/relationships must be an array");
  }
  if (job.functions != null && !Array.isArray(job.functions)) {
    errors.push("functions must be an array");
  }
  if (job.classes != null && !Array.isArray(job.classes)) {
    errors.push("classes must be an array");
  }
  if (job.imports != null && !Array.isArray(job.imports)) {
    errors.push("imports must be an array");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
