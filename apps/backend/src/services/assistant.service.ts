import OpenAI from "openai";
import { hashString, createMemoryCache, withRetry } from "@repo/shared";
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
import { getPool } from "@repo/database";
import { createContextAdapter } from "../adapters/context-builder.adapter.js";
import { runCodebaseAnalysisIfConfigured } from "./analysis-options.service.js";
import { getRepoId } from "./workspace.service.js";

const FALLBACK_NO_CONTEXT = "No relevant code found in repository.";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const DIRECT_LLM_CACHE_TTL = Math.max(
  0,
  parseInt(process.env.DIRECT_LLM_CACHE_TTL ?? "900", 10),
);

const directLLMCache = createMemoryCache<AssistantPipelineResult>();

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set it in .env for direct LLM and intent reasoning.",
    );
  }
  return new OpenAI({ apiKey });
}

export interface AssistantPipelineResult {
  intent: { intent: string; summary: string };
  context: {
    files: string[];
    functions: string[];
    snippets: string[];
    estimatedTokens: number;
  };
  /** For code-related intents: what's in place, what's missing, suggested next step. */
  reasoning?: {
    detectedComponents: string[];
    missingComponents: string[];
    potentialIssues: string[];
    recommendedNextStep?: string;
  };
}

function log(message: string, data?: unknown): void {
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.log(`[Viper] ${message}`, data !== undefined ? data : "");
  }
}

function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 503;
}

/** Direct LLM path (no context retrieval). Uses OpenAI gpt-4o-mini with cache and retry. */
async function runDirectLLM(prompt: string): Promise<AssistantPipelineResult> {
  const cacheKey = `direct-llm:${hashString(prompt)}`;
  if (DIRECT_LLM_CACHE_TTL > 0) {
    const cached = await directLLMCache.get(cacheKey);
    if (cached !== null) {
      if (process.env.NODE_ENV !== "test") {
        console.log("[Viper] LLM cache hit");
      }
      return cached;
    }
  }
  if (process.env.NODE_ENV !== "test") {
    console.log("[Viper] LLM cache miss");
  }

  try {
    if (process.env.NODE_ENV !== "test") {
      console.log("[Viper] Direct LLM response generated");
    }
    const client = getOpenAIClient();
    const response = await withRetry(
      () =>
        client.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are an AI software engineering assistant. Answer concisely and helpfully.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        }),
      { maxRetries: 3, retryDelayMs: 500, isRetryable: isRetryableError },
    );
    const content =
      response.choices[0]?.message?.content?.trim() ?? FALLBACK_NO_CONTEXT;
    const estimatedTokens = Math.ceil(content.length / 4);
    const result: AssistantPipelineResult = {
      intent: { intent: "GENERIC", summary: "General question" },
      context: {
        files: [],
        functions: [],
        snippets: [content],
        estimatedTokens,
      },
    };
    if (DIRECT_LLM_CACHE_TTL > 0) {
      await directLLMCache.set(cacheKey, result, DIRECT_LLM_CACHE_TTL);
    }
    return result;
  } catch (error) {
    console.error("[Viper] Direct LLM provider error", error);
    throw new Error(
      "Direct LLM request failed. Check OPENAI_API_KEY and network.",
    );
  }
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
    return await runDirectLLM(prompt);
  }

  if (!decision.runContextEngine) {
    return await runDirectLLM(prompt);
  }

  log("Context retrieval start");
  const repo_id = getRepoId(workspacePath);

  // Option A: run codebase analysis on every code-related chat request for fresh embeddings/metadata
  const analysisRan = await runCodebaseAnalysisIfConfigured(workspacePath, repo_id);
  if (analysisRan) {
    const waitMs = Math.max(0, parseInt(process.env.RUN_ANALYSIS_WAIT_MS ?? "12000", 10));
    if (waitMs > 0) {
      log("Waiting for analysis pipeline", { waitMs });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  const qdrantUrl = process.env.QDRANT_URL ?? "http://localhost:6333";
  const openaiApiKey = process.env.OPENAI_API_KEY;

  const adapter: ContextBuilderAdapter =
    databaseUrl && openaiApiKey
      ? createContextAdapter({
          repo_id,
          pool: getPool(),
          qdrantUrl,
          openaiApiKey,
        })
      : (await getIntentAgentAdapter()) as unknown as ContextBuilderAdapter;

  const rawContext: RawContextBundle = await buildRawContext(
    repo_id,
    intentResult.contextRequest,
    adapter,
  );

  // Verify buildRawContext returns non-empty data when analysis has been run
  const hasRawData =
    rawContext.files.length > 0 ||
    rawContext.functions.length > 0 ||
    rawContext.classes.length > 0 ||
    rawContext.embeddings.length > 0 ||
    rawContext.dependencies.length > 0;
  if (!hasRawData && analysisRan) {
    log("Context empty after analysis — pipeline may still be running or workspace has no indexed code");
  } else if (!hasRawData) {
    log("Context empty — run codebase analysis (POST /analysis/run) to populate symbols and embeddings");
  }

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
      reasoning: intentResult.reasoning
        ? {
            detectedComponents: intentResult.reasoning.detectedComponents ?? [],
            missingComponents: intentResult.reasoning.missingComponents ?? [],
            potentialIssues: intentResult.reasoning.potentialIssues ?? [],
            recommendedNextStep: intentResult.reasoning.recommendedNextStep,
          }
        : undefined,
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
      reasoning: intentResult.reasoning
        ? {
            detectedComponents: intentResult.reasoning.detectedComponents ?? [],
            missingComponents: intentResult.reasoning.missingComponents ?? [],
            potentialIssues: intentResult.reasoning.potentialIssues ?? [],
            recommendedNextStep: intentResult.reasoning.recommendedNextStep,
          }
        : undefined,
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
    reasoning: intentResult.reasoning
      ? {
          detectedComponents: intentResult.reasoning.detectedComponents ?? [],
          missingComponents: intentResult.reasoning.missingComponents ?? [],
          potentialIssues: intentResult.reasoning.potentialIssues ?? [],
          recommendedNextStep: intentResult.reasoning.recommendedNextStep,
        }
      : undefined,
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
