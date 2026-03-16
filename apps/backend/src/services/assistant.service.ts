import { runIntentPipeline, getIntentAgentAdapter } from "../lib/intent-agent-loader.js";
import { routeTools } from "../router/tool-router/index.js";
import { buildRawContext } from "@repo/context-builder";
import {
  generateCandidates,
  computeCandidateScores,
  combineScores,
  selectTopK,
  buildContextWindow,
} from "@repo/context-ranking";
import type { ContextBuilderAdapter, RawContextBundle } from "@repo/context-builder";

const FALLBACK_NO_CONTEXT = "No relevant code found in repository.";

export interface AssistantPipelineResult {
  intent: { intent: string; summary: string };
  context: {
    files: string[];
    functions: string[];
    snippets: string[];
    estimatedTokens: number;
  };
}

function log(message: string, data?: unknown): void {
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.log(`[Viper] ${message}`, data !== undefined ? data : "");
  }
}

/** Stub for direct LLM path (no context retrieval). Implementation Agent can replace later. */
function runDirectLLM(_prompt: string): AssistantPipelineResult {
  return {
    intent: { intent: "GENERIC", summary: "General question" },
    context: {
      files: [],
      functions: [],
      snippets: [FALLBACK_NO_CONTEXT],
      estimatedTokens: 0,
    },
  };
}

export async function runAssistantPipeline(
  prompt: string,
  workspacePath: string,
): Promise<AssistantPipelineResult> {
  const intentResult = await runIntentPipeline(prompt);

  log("Intent classification", {
    intentType: intentResult.intent.intentType,
    summary: intentResult.response.summary,
  });

  const decision = routeTools(
    intentResult.intent,
    intentResult.entities,
    intentResult.tasks,
  );
  log("Routing decision", decision);

  if (decision.directLLMResponse) {
    log("Direct LLM response (skipping context retrieval)");
    return runDirectLLM(prompt);
  }

  if (!decision.runContextEngine) {
    return runDirectLLM(prompt);
  }

  log("Context retrieval start");
  const adapter = await getIntentAgentAdapter();
  const repo_id = workspacePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "repo";

  const rawContext: RawContextBundle = await buildRawContext(
    repo_id,
    intentResult.contextRequest,
    adapter as ContextBuilderAdapter,
  );

  if (!decision.runRanking) {
    const contextWindow = buildContextWindow({
      files: rawContext.files.map((f) => f.file),
      functions: rawContext.functions.map((f) => f.name),
      snippets: rawContext.embeddings.map((e) => ({
        file: e.file,
        content: e.content,
        score: e.score,
      })),
    });
    log("Context window size", contextWindow.estimatedTokens);
    return {
      intent: {
        intent: intentResult.response.intent,
        summary: intentResult.response.summary,
      },
      context: {
        files: contextWindow.files,
        functions: contextWindow.functions,
        snippets: contextWindow.snippets,
        estimatedTokens: contextWindow.estimatedTokens,
      },
    };
  }

  const candidates = generateCandidates(rawContext);
  const scoringContext = {
    query: prompt,
    entities: intentResult.entities.entities.map((e: { value: string }) => e.value),
    rawContext: { dependencies: rawContext.dependencies },
    openedFiles: [],
  };
  const scored = computeCandidateScores(candidates, scoringContext);
  const ranked = combineScores(scored);
  log("Ranking complete");
  const bundle = selectTopK(ranked);
  const contextWindow = buildContextWindow(bundle);
  log("Context window size", contextWindow.estimatedTokens);

  const hasContext =
    contextWindow.files.length > 0 ||
    contextWindow.functions.length > 0 ||
    contextWindow.snippets.length > 0;

  if (!hasContext) {
    return {
      intent: {
        intent: intentResult.response.intent,
        summary: intentResult.response.summary,
      },
      context: {
        files: [],
        functions: [],
        snippets: [FALLBACK_NO_CONTEXT],
        estimatedTokens: 0,
      },
    };
  }

  return {
    intent: {
      intent: intentResult.response.intent,
      summary: intentResult.response.summary,
    },
    context: {
      files: contextWindow.files,
      functions: contextWindow.functions,
      snippets: contextWindow.snippets,
      estimatedTokens: contextWindow.estimatedTokens,
    },
  };
}

export interface ContextDebugResult {
  intent: Record<string, unknown>;
  rawContext: Record<string, unknown>;
  candidates: unknown[];
  ranked: unknown[];
  contextWindow: Record<string, unknown>;
}

export async function runContextDebugPipeline(prompt: string): Promise<ContextDebugResult> {
  const intentResult = await runIntentPipeline(prompt);
  const adapter = await getIntentAgentAdapter();
  const repo_id = "debug-repo";

  const rawContext = await buildRawContext(
    repo_id,
    intentResult.contextRequest,
    adapter as ContextBuilderAdapter,
  );

  const candidates = generateCandidates(rawContext);
  const scoringContext = {
    query: prompt,
    entities: intentResult.entities.entities.map((e: { value: string }) => e.value),
    rawContext: { dependencies: rawContext.dependencies },
    openedFiles: [],
  };
  const scored = computeCandidateScores(candidates, scoringContext);
  const ranked = combineScores(scored);
  const bundle = selectTopK(ranked);
  const contextWindow = buildContextWindow(bundle);

  return {
    intent: intentResult.response as unknown as Record<string, unknown>,
    rawContext: rawContext as unknown as Record<string, unknown>,
    candidates: candidates as unknown[],
    ranked: ranked as unknown[],
    contextWindow: contextWindow as unknown as Record<string, unknown>,
  };
}
