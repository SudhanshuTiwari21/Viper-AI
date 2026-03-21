import { runImplementation } from "@repo/implementation-agent";
import type { ContextWindow } from "@repo/context-ranking";
import type { ToolInput, ToolOutput } from "./tool.types";
import type { ExecutionContext } from "../engine/execution.types";

export async function runImplementationTool(
  input: ToolInput,
  ctx: ExecutionContext,
): Promise<ToolOutput> {
  if (!ctx.workspacePath) {
    ctx.logs.push("[Viper] GENERATE_PATCH skipped: no workspacePath provided");
    return {};
  }

  if (!ctx.plan) {
    ctx.logs.push("[Viper] GENERATE_PATCH skipped: no execution plan in context");
    return {};
  }

  const lastWithResult = [...ctx.intermediateResults]
    .reverse()
    .find((r) => r.result !== undefined);

  const contextWindow: ContextWindow = lastWithResult?.result ?? {
    files: [],
    functions: [],
    snippets: [],
    estimatedTokens: 0,
  };

  const result = await runImplementation({
    plan: ctx.plan,
    contextWindow,
    prompt: ctx.query,
    workspacePath: ctx.workspacePath,
  });

  result.logs.forEach((l) => ctx.logs.push(l));

  return { result: result };
}
