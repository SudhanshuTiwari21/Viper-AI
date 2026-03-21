import OpenAI from "openai";
import { buildCacheKey, createMemoryCache, withRetry } from "@repo/shared";
import { buildExecutionPlan, type ExecutionPlan } from "@repo/planner-agent";
import { executePlan } from "@repo/execution-engine";
import type { ContextWindow } from "@repo/context-ranking";
import {
  runIntentPipeline,
  getIntentAgentAdapter,
  runIntentReasoning,
} from "../lib/intent-agent-loader.js";
import { routeTools } from "../router/tool-router/index.js";
import type { ContextBuilderAdapter } from "@repo/context-builder";
import { getPool } from "@repo/database";
import { createContextAdapter } from "../adapters/context-builder.adapter.js";
import { runCodebaseAnalysisIfConfigured } from "./analysis-options.service.js";
import { getRepoId } from "./workspace.service.js";

const FALLBACK_NO_CONTEXT = "No relevant code found in repository.";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const DISABLE_LLM_CACHE =
  (process.env.DISABLE_LLM_CACHE ?? "false").toLowerCase() === "true";
const DIRECT_LLM_CACHE_TTL = DISABLE_LLM_CACHE
  ? 0
  : Math.max(0, parseInt(process.env.DIRECT_LLM_CACHE_TTL ?? "900", 10));

const CHAT_HISTORY_LIMIT = Math.max(
  0,
  Math.min(10, parseInt(process.env.CHAT_HISTORY_LIMIT ?? "10", 10)),
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

function toRoutingTasks(plan: ExecutionPlan): { tasks: Array<{ type: string }> } {
  return {
    tasks: plan.steps.map((step) => ({ type: step.type })),
  };
}

/** Direct LLM path (no context retrieval). Uses OpenAI gpt-4o-mini with cache and retry. */
async function runDirectLLM(
  prompt: string,
  lastMessages: Array<{ role: "user" | "assistant"; content: string }> = [],
  args: {
    workspaceKey: string;
    conversationId?: string;
    intentType?: string;
  },
): Promise<AssistantPipelineResult> {
  const cacheKey = `direct-llm:${buildCacheKey({
    workspaceKey: args.workspaceKey,
    conversationId: args.conversationId,
    prompt,
    messages: lastMessages,
    intentType: args.intentType ?? "DIRECT_LLM",
    contextHash: "",
  })}`;
  const canUseCache = DIRECT_LLM_CACHE_TTL > 0 && Boolean(args.conversationId);
  if (canUseCache) {
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
            ...lastMessages.slice(-CHAT_HISTORY_LIMIT).map((m) => ({
              role: m.role,
              content: m.content,
            })),
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
    if (canUseCache) {
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

function resolveAdapter(repo_id: string): ContextBuilderAdapter | null {
  const databaseUrl = process.env.DATABASE_URL;
  const qdrantUrl = process.env.QDRANT_URL ?? "http://localhost:6333";
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (databaseUrl && openaiApiKey) {
    return createContextAdapter({
      repo_id,
      pool: getPool(),
      qdrantUrl,
      openaiApiKey,
    });
  }
  return null;
}

export async function runAssistantPipeline(
  prompt: string,
  workspacePath: string,
  conversationId?: string,
  messages: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<AssistantPipelineResult> {
  const lastMessages = messages.slice(-CHAT_HISTORY_LIMIT);
  const workspaceKey = workspacePath.replace(/\\/g, "/").replace(/\/$/, "");
  const historyAwarePrompt =
    lastMessages.length > 0
      ? `${lastMessages
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n")}\nUser: ${prompt}`
      : prompt;

  // 1. Intent classification (pure, no LLM reasoning or context)
  const intentResult = await runIntentPipeline(historyAwarePrompt, {
    cacheContext: {
      workspaceKey,
      conversationId,
      messages: lastMessages,
      contextHash: "",
    },
    skipReasoning: true,
    skipContextRequest: true,
  });

  // 2. Execution plan from intent + entities
  const plan = buildExecutionPlan(
    intentResult.intent.intentType,
    intentResult.entities.entities.map((entity) => entity.value),
  );
  log("Execution Plan:", plan);

  const tasksForRouting = toRoutingTasks(plan);

  log("Intent classification", {
    intentType: intentResult.intent.intentType,
    summary: intentResult.response?.summary ?? intentResult.intent.intentType,
  });

  // 3. Routing decision
  const decision = routeTools(
    intentResult.intent,
    intentResult.entities,
    tasksForRouting,
  );
  log("Routing decision", decision);

  if (decision.directLLMResponse || !decision.runContextEngine) {
    log("Direct LLM response (skipping context retrieval)");
    return await runDirectLLM(prompt, lastMessages, {
      workspaceKey,
      conversationId,
      intentType: intentResult.intent.intentType,
    });
  }

  // 4. Pre-flight: codebase analysis + adapter
  log("Context retrieval start");
  const repo_id = getRepoId(workspacePath);

  const analysisRan = await runCodebaseAnalysisIfConfigured(workspacePath, repo_id);
  if (analysisRan) {
    const waitMs = Math.max(0, parseInt(process.env.RUN_ANALYSIS_WAIT_MS ?? "12000", 10));
    if (waitMs > 0) {
      log("Waiting for analysis pipeline", { waitMs });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  const adapter: ContextBuilderAdapter =
    resolveAdapter(repo_id) ??
    ((await getIntentAgentAdapter()) as unknown as ContextBuilderAdapter);

  // 5. Execute plan via Execution Engine
  const executionResult = await executePlan(plan, {
    repo_id,
    query: historyAwarePrompt,
    adapter,
    workspacePath,
  });
  executionResult.logs.forEach((l) => log(l));

  const contextWindow: ContextWindow = executionResult.contextWindow ?? {
    files: [],
    functions: [],
    snippets: [],
    estimatedTokens: 0,
  };
  log("Context window size", contextWindow.estimatedTokens);

  const hasContext =
    contextWindow.files.length > 0 ||
    contextWindow.functions.length > 0 ||
    contextWindow.snippets.length > 0;

  // 6. Optional reasoning (LLM-based analysis of context)
  const reasoningFromContext = await runIntentReasoning(
    prompt,
    intentResult.intent,
    intentResult.entities,
    tasksForRouting,
    {
      files: contextWindow.files,
      functions: contextWindow.functions,
      classes: [],
      dependencies: [],
    },
    {
      cacheContext: {
        workspaceKey,
        conversationId,
        messages: lastMessages,
        contextHash: "",
      },
    },
  );

  const intentSummary = {
    intent: intentResult.response?.intent ?? intentResult.intent.intentType,
    summary:
      intentResult.response?.summary ?? intentResult.intent.intentType,
  };

  const reasoning = reasoningFromContext
    ? {
        detectedComponents: reasoningFromContext.detectedComponents ?? [],
        missingComponents: reasoningFromContext.missingComponents ?? [],
        potentialIssues: reasoningFromContext.potentialIssues ?? [],
        recommendedNextStep: reasoningFromContext.recommendedNextStep,
      }
    : undefined;

  if (!hasContext) {
    return {
      intent: intentSummary,
      context: {
        files: [],
        functions: [],
        snippets: [FALLBACK_NO_CONTEXT],
        estimatedTokens: 0,
      },
      reasoning,
    };
  }

  return {
    intent: intentSummary,
    context: {
      files: contextWindow.files,
      functions: contextWindow.functions,
      snippets: contextWindow.snippets,
      estimatedTokens: contextWindow.estimatedTokens,
    },
    reasoning,
  };
}

export interface ContextDebugResult {
  intent: Record<string, unknown>;
  executionResult: Record<string, unknown>;
  contextWindow: Record<string, unknown>;
}

export async function runContextDebugPipeline(prompt: string): Promise<ContextDebugResult> {
  const intentResult = await runIntentPipeline(prompt);
  const adapter = (await getIntentAgentAdapter()) as unknown as ContextBuilderAdapter;
  const repo_id = "debug-repo";

  const plan = buildExecutionPlan(
    intentResult.intent.intentType,
    intentResult.entities.entities.map((entity) => entity.value),
  );
  log("Execution Plan:", plan);

  const result = await executePlan(plan, {
    repo_id,
    query: prompt,
    adapter,
  });
  result.logs.forEach((l) => log(l));

  return {
    intent: (intentResult.response ?? {
      intent: intentResult.intent.intentType,
      summary: intentResult.intent.intentType,
    }) as unknown as Record<string, unknown>,
    executionResult: result as unknown as Record<string, unknown>,
    contextWindow: (result.contextWindow ?? {}) as unknown as Record<string, unknown>,
  };
}
