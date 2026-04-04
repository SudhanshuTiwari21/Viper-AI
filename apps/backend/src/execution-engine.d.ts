declare module "@repo/execution-engine" {
  import type { ContextBuilderAdapter } from "@repo/context-builder";
  import type { ContextWindow, RetrievalConfidenceV1 } from "@repo/context-ranking";

  export interface ExecutionPlan {
    intent: string;
    steps: Array<{
      id: string;
      type: string;
      description: string;
      entities?: string[];
    }>;
  }

  export interface EngineMemorySnapshot {
    lastIntent?: { intent: string; summary: string; entities?: string[] };
    lastPatch?: { files: string[]; success: boolean };
    lastError?: string;
    lastLoopReflection?: {
      iteration: number;
      strategy: string;
      failureSummary: string;
      shouldRetry: boolean;
    };
    recentFiles: string[];
    narrative: string;
  }

  export type RecordStepFn = (
    stepId: string,
    stepType: string,
    status: "started" | "completed" | "skipped" | "failed",
    durationMs?: number,
    reason?: string,
  ) => void;

  export interface StepOutput {
    stepId: string;
    stepType: string;
    result?: ContextWindow;
  }

  export interface ExecutionResult {
    logs: string[];
    contextWindow?: ContextWindow;
    stepOutputs: StepOutput[];
  }

  export type StreamEvent =
    | { type: "stream:open"; data: Record<string, never> }
    | { type: "keepalive"; data: Record<string, never> }
    | { type: "intent"; data: { intent: string; summary: string } }
    | { type: "plan"; data: { stepCount: number; steps: Array<{ id: string; type: string }> } }
    | { type: "plan:narrative:start"; data: Record<string, never> }
    | { type: "plan:narrative:delta"; data: { content: string } }
    | { type: "plan:narrative:complete"; data: Record<string, never> }
    | { type: "step:start"; data: { stepId: string; stepType: string; iteration?: number } }
    | { type: "step:complete"; data: { stepId: string; stepType: string; durationMs: number } }
    | { type: "step:skip"; data: { stepId: string; stepType: string; reason: string } }
    | { type: "context:retrieved"; data: { files: number; functions: number; tokens: number } }
    | { type: "retrieval:confidence"; data: RetrievalConfidenceV1 }
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
    | { type: "patch:generated"; data: { changes: number; operations: number } }
    | { type: "patch:validated"; data: { valid: boolean; errors?: string[] } }
    | {
        type: "patch:preview";
        data: {
          patch: unknown;
          diffs: Array<{ file: string; before: string; after: string }>;
          workspacePath: string;
          previewId: string;
          patchHash: string;
        };
      }
    | { type: "patch:applied"; data: { success: boolean; filesChanged: number; rollbackId?: string } }
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
            retrievalOverall?: number;
            retrievalThreshold?: number;
            confidenceSchemaVersion?: string;
          };
        };
      }
    | { type: "step:awaiting_approval"; data: { summary: string; editedFiles: string[]; stepNumber: number } }
    | { type: "validation:started"; data: { command: string; tool?: string } }
    | { type: "validation:passed"; data: { exitCode: 0; summary: string } }
    | { type: "validation:failed"; data: { exitCode: number; error: string } }
    | {
        type: "auto-repair:attempt";
        data: {
          cycle: number;
          tool?: string;
          command?: string;
          skipped?: boolean;
          reason?: string;
        };
      }
    | {
        type: "auto-repair:result";
        data: {
          cycle: number;
          success: boolean;
          skipped?: boolean;
          exitCode?: number;
          summary?: string;
          reason?: string;
          error?: string;
        };
      }
    | { type: "reasoning:start"; data: Record<string, never> }
    | { type: "reasoning:complete"; data: Record<string, never> }
    | { type: "model:route:summary"; data: Record<string, unknown> }
    | {
        type: "browser:step";
        data: {
          phase:
            | "session:start"
            | "navigate"
            | "screenshot"
            | "assert:pass"
            | "assert:fail"
            | "policy:denied"
            | "session:end";
          stepIndex?: number;
          detail?: string;
          url?: string;
          rawBytes?: number;
          kind?: string;
        };
      }
    | { type: "command:output"; data: { content: string } }
    | { type: "context:searching"; data: Record<string, never> }
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

  export function executePlan(
    plan: ExecutionPlan,
    opts: {
      repo_id: string;
      query: string;
      adapter: ContextBuilderAdapter;
      workspacePath?: string;
      onEvent?: OnStreamEvent;
      previewMode?: boolean;
      memory?: EngineMemorySnapshot;
      recordStep?: RecordStepFn;
      iteration?: number;
      blockedStepTypes?: ReadonlySet<string>;
    },
  ): Promise<ExecutionResult>;
}
