import type { ExecutionPlan } from "@repo/planner-agent";

export type StreamEvent =
  | { type: "intent"; data: { intent: string; summary: string } }
  | {
      type: "plan";
      data: {
        stepCount: number;
        steps: Array<{ id: string; type: string }>;
      };
    }
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
