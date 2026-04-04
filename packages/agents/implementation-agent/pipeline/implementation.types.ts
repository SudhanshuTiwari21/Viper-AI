import type { ExecutionPlan } from "@repo/planner-agent";
import type { ContextWindow } from "@repo/context-ranking";

/** Structurally compatible with OnStreamEvent from @repo/execution-engine.
 *  Defined locally to avoid circular dependency. */
export type StreamCallback = (event: { type: string; data: unknown }) => void;

export type ImplementationMode = "auto" | "preview";

export interface ImplementationInput {
  plan: ExecutionPlan;
  contextWindow: ContextWindow;
  prompt: string;
  workspacePath: string;
  onEvent?: StreamCallback;
  /** "auto" applies immediately; "preview" returns patch+diffs without applying. */
  mode?: ImplementationMode;
}

export interface FileChange {
  file: string;
  content: string;
}

export type PatchOperationType = "insert" | "replace" | "delete";

export interface PatchOperation {
  file: string;
  type: PatchOperationType;
  /** 1-based line number */
  startLine: number;
  /** 1-based inclusive; required for replace/delete */
  endLine?: number;
  /** Required for insert/replace */
  content?: string;
  /** Optional conflict guard against stale context */
  expectedOldText?: string;
}

export interface Patch {
  changes: FileChange[];
  operations: PatchOperation[];
}

export interface FileDiff {
  file: string;
  before: string;
  after: string;
}

export interface ImplementationResult {
  patch: Patch;
  diffs: FileDiff[];
  success: boolean;
  logs: string[];
  rollbackId?: string;
}

export interface GeneratedPatchPayload {
  changes?: FileChange[];
  operations?: PatchOperation[];
}
