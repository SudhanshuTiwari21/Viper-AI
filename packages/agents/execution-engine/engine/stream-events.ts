import type { ExecutionPlan } from "@repo/planner-agent";

export type StreamEvent =
  | { type: "stream:open"; data: Record<string, never> }
  | { type: "keepalive"; data: Record<string, never> }
  | { type: "intent"; data: { intent: string; summary: string } }
  | {
      type: "plan";
      data: {
        stepCount: number;
        steps: Array<{ id: string; type: string }>;
      };
    }
  | { type: "plan:narrative:start"; data: Record<string, never> }
  | { type: "plan:narrative:delta"; data: { content: string } }
  | { type: "plan:narrative:complete"; data: Record<string, never> }
  | {
      type: "step:start";
      data: { stepId: string; stepType: string; iteration?: number };
    }
  | {
      type: "step:complete";
      data: { stepId: string; stepType: string; durationMs: number };
    }
  | {
      type: "step:skip";
      data: { stepId: string; stepType: string; reason: string };
    }
  | {
      type: "context:retrieved";
      data: { files: number; functions: number; tokens: number };
    }
  /** File paths + counts for IDE exploration UI (project setup / retrieval). */
  | {
      type: "context:explored";
      data: {
        files: string[];
        counts?: { files: number; functions: number; tokens: number };
      };
    }
  | { type: "workspace:preparing"; data: { phase: string } }
  | { type: "thinking:start"; data: Record<string, never> }
  | { type: "thinking:delta"; data: { content: string } }
  | { type: "thinking:complete"; data: Record<string, never> }
  | { type: "patch:start"; data: Record<string, never> }
  | { type: "token"; data: { content: string } }
  | {
      type: "patch:generated";
      data: { changes: number; operations: number };
    }
  | { type: "patch:validated"; data: { valid: boolean; errors?: string[] } }
  | {
      type: "patch:preview";
      data: {
        patch: { changes: unknown[]; operations: unknown[] };
        diffs: Array<{ file: string; before: string; after: string }>;
        workspacePath: string;
        previewId: string;
        patchHash: string;
      };
    }
  | {
      type: "patch:applied";
      data: {
        success: boolean;
        filesChanged: number;
        rollbackId?: string;
      };
    }
  | { type: "tool:start"; data: { tool: string; args: Record<string, string> } }
  | { type: "tool:result"; data: { tool: string; summary: string; durationMs: number } }
  | {
      type: "workflow:gate";
      data: {
        gate: "edit";
        status: "blocked" | "passed";
        tool: "edit_file" | "create_file";
        path?: string;
        reason?: string;
        metrics?: {
          filesRead?: number;
          requiredFilesRead?: number;
          discoveryCount?: number;
          requiredDiscovery?: number;
          analysisReady?: boolean;
        };
      };
    }
  | { type: "step:awaiting_approval"; data: { summary: string; editedFiles: string[]; stepNumber: number } }
  | { type: "reasoning:start"; data: Record<string, never> }
  | { type: "reasoning:complete"; data: Record<string, never> }
  | { type: "result"; data: unknown }
  | { type: "error"; data: { message: string } }
  | {
      type: "reflection";
      data: {
        iteration: number;
        summary: string;
        shouldRetry: boolean;
        strategy?: string;
      };
    }
  | { type: "done"; data: Record<string, never> };

export type OnStreamEvent = (event: StreamEvent) => void;
