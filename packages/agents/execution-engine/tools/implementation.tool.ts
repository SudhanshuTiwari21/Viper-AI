import { randomUUID } from "node:crypto";
import { runImplementation, registerPatchPreview } from "@repo/implementation-agent";
import type { StreamCallback } from "@repo/implementation-agent";
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

  const mode = ctx.previewMode ? "preview" as const : "auto" as const;

  ctx.onEvent?.({ type: "patch:start", data: {} });

  const result = await runImplementation({
    plan: ctx.plan,
    contextWindow,
    prompt: ctx.query,
    workspacePath: ctx.workspacePath,
    onEvent: ctx.onEvent as StreamCallback | undefined,
    mode,
  });

  result.logs.forEach((l) => ctx.logs.push(l));

  if (ctx.previewMode && result.success) {
    const previewId = randomUUID();
    const patchHash = registerPatchPreview(
      previewId,
      result.patch,
      ctx.workspacePath,
    );
    ctx.onEvent?.({
      type: "patch:preview",
      data: {
        patch: result.patch,
        diffs: result.diffs,
        workspacePath: ctx.workspacePath,
        previewId,
        patchHash,
      },
    });
  } else {
    const filesChanged = new Set([
      ...result.patch.changes.map((c) => c.file),
      ...result.patch.operations.map((o) => o.file),
    ]).size;

    ctx.onEvent?.({
      type: "patch:applied",
      data: {
        success: result.success,
        filesChanged,
        rollbackId: result.rollbackId,
      },
    });
  }

  return {};
}
