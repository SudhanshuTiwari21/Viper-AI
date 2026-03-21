import type { ExecutionPlan } from "@repo/planner-agent";
import type { ContextWindow } from "@repo/context-ranking";

export interface ImplementationInput {
  plan: ExecutionPlan;
  contextWindow: ContextWindow;
  prompt: string;
  workspacePath: string;
}

export interface FileChange {
  file: string;
  content: string;
}

export interface Patch {
  changes: FileChange[];
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
}
