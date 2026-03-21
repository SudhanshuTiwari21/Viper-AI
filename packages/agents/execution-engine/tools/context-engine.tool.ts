import { buildRawContext } from "@repo/context-builder";
import type { ContextRequest } from "@repo/context-builder";
import {
  generateCandidates,
  computeCandidateScores,
  combineScores,
  selectTopK,
  buildContextWindow,
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
  const bundle = selectTopK(ranked);
  const window = buildContextWindow(bundle);

  return { result: window };
}
