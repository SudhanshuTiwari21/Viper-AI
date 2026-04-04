import type { ExecutionContext } from "../engine/execution.types";

export interface ToolInput {
  type: string;
  entities?: string[];
}

export interface ToolOutput {
  result?: unknown;
}

export type ToolFn = (
  input: ToolInput,
  ctx: ExecutionContext,
) => Promise<ToolOutput>;
