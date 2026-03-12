import type { EmbeddingGenerateJob } from "../types/embedding-job.types";

export interface EmbeddingValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate incoming embedding job. Invalid job → log and skip.
 */
export function validateEmbeddingJob(payload: unknown): EmbeddingValidationResult {
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
  if (!job.content || typeof job.content !== "string") {
    errors.push("missing or invalid content");
  }
  if (job.module != null && typeof job.module !== "string") {
    errors.push("invalid module");
  }
  if (job.symbol != null && typeof job.symbol !== "string") {
    errors.push("invalid symbol");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Type guard: payload is valid EmbeddingGenerateJob.
 */
export function isValidEmbeddingJob(
  payload: unknown,
  result: EmbeddingValidationResult
): payload is EmbeddingGenerateJob {
  return result.valid && payload != null && typeof payload === "object";
}
