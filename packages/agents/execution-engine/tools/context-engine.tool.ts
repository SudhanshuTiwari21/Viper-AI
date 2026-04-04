import { buildRawContext } from "@repo/context-builder";
import type { ContextRequest } from "@repo/context-builder";
import {
  generateCandidates,
  computeCandidateScores,
  combineScores,
  selectTopK,
  CONTEXT_LIMITS,
  buildContextWindow,
  buildRetrievalConfidence,
} from "@repo/context-ranking";
import type { ToolInput, ToolOutput } from "./tool.types";
import type { ExecutionContext } from "../engine/execution.types";

function buildContextRequestFromStep(input: ToolInput): ContextRequest {
  const entities = input.entities ?? [];
  switch (input.type) {
    case "SEARCH_SYMBOL":
      return { symbolSearch: entities };
    case "SEARCH_EMBEDDING":
      return { embeddingSearch: entities };
    case "FETCH_DEPENDENCIES":
      return { dependencyLookup: true };
    default:
      return {};
  }
}

export async function runContextTool(
  input: ToolInput,
  ctx: ExecutionContext,
): Promise<ToolOutput> {
  const contextRequest = buildContextRequestFromStep(input);

  const raw = await buildRawContext(ctx.repo_id, contextRequest, ctx.adapter);

  const candidates = generateCandidates(raw);

  const scored = computeCandidateScores(candidates, {
    query: ctx.query,
    entities: input.entities ?? [],
    rawContext: { dependencies: raw.dependencies },
    openedFiles: [],
  });

  const ranked = combineScores(scored);
  const iter = ctx.iteration ?? 0;
  const depth = 1 + Math.min(iter, 2) * 0.5;
  const bundle = selectTopK(ranked, {
    files: Math.max(1, Math.round(CONTEXT_LIMITS.files * depth)),
    functions: Math.max(1, Math.round(CONTEXT_LIMITS.functions * depth)),
    snippets: Math.max(1, Math.round(CONTEXT_LIMITS.snippets * depth)),
  });
  const window = buildContextWindow(bundle);
  const confidence = buildRetrievalConfidence({
    rankedCandidates: ranked,
    bundle,
    contextWindow: window,
  });

  ctx.logs.push(
    `[Viper] context tool ${input.type} iteration=${iter} topK depth≈${depth.toFixed(2)}`,
  );

  ctx.onEvent?.({ type: "retrieval:confidence", data: confidence });
  ctx.onEvent?.({
    type: "context:retrieved",
    data: {
      files: window.files.length,
      functions: window.functions.length,
      tokens: window.estimatedTokens,
    },
  });

  return { result: window };
}
