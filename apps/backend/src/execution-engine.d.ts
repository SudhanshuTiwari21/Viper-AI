declare module "@repo/execution-engine" {
  import type { ContextBuilderAdapter } from "@repo/context-builder";
  import type { ContextWindow } from "@repo/context-ranking";

  export interface ExecutionPlan {
    intent: string;
    steps: Array<{
      id: string;
      type: string;
      description: string;
      entities?: string[];
    }>;
  }

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

  export function executePlan(
    plan: ExecutionPlan,
    opts: {
      repo_id: string;
      query: string;
      adapter: ContextBuilderAdapter;
      workspacePath?: string;
    },
  ): Promise<ExecutionResult>;
}
