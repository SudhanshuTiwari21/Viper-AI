/**
 * Centralized orchestration flags for the assistant service (chat/stream path).
 * Single source of truth for env reads that previously lived at the top of assistant.service.ts.
 *
 * Env reference (defaults match prior assistant.service behavior):
 *
 * - VIPER_DEBUG_ASSISTANT — "1" enables assistant debug logs (default: off)
 * - VIPER_DEBUG_WORKFLOW — "1" enables workflow-stage + schema validation logs (default: off)
 * - VIPER_ENABLE_STREAM_CONTEXT_PRIMER — default true unless value lowercase is "false"
 * - VIPER_STREAM_ANALYSIS_WARMUP_MS — int, default 2500, clamped with Math.max(0, …)
 * - VIPER_REQUIRE_ANALYSIS_FOR_EDITS — default false unless lowercase is "true"
 * - VIPER_MIN_FILES_READ_BEFORE_EDIT — int, default 2, Math.max(0, …)
 * - VIPER_MIN_DISCOVERY_TOOLS_BEFORE_EDIT — int, default 1, Math.max(0, …)
 * - OPENAI_MODEL — default gpt-4o-mini
 * - DISABLE_LLM_CACHE — default false unless lowercase is "true"
 * - DIRECT_LLM_CACHE_TTL — int, default 900, Math.max(0, …); forced 0 when DISABLE_LLM_CACHE
 * - CHAT_HISTORY_LIMIT — int, default 10, clamped Math.max(0, Math.min(10, …))
 * - RUN_ANALYSIS_WAIT_MS — int, default 12000, Math.max(0, …)
 *
 * Debug HTTP (A.5) — not part of assistant parsing above:
 * - VIPER_EXPOSE_WORKFLOW_DEBUG — "1" exposes GET /debug/workflow-policy; default off (404)
 */

export interface WorkflowRuntimeConfig {
  readonly debugAssistant: boolean;
  readonly debugWorkflow: boolean;
  readonly enableStreamContextPrimer: boolean;
  readonly streamAnalysisWarmupMs: number;
  readonly requireAnalysisForEdits: boolean;
  readonly minFilesReadBeforeEdit: number;
  readonly minDiscoveryToolsBeforeEdit: number;
  readonly openaiModel: string;
  readonly disableLlmCache: boolean;
  readonly directLlmCacheTtl: number;
  readonly chatHistoryLimit: number;
  readonly runAnalysisWaitMs: number;
  /**
   * Forward-compat for A.5 runtime policy snapshot (product interaction mode).
   * Not wired to env yet — reserved for future mode contract.
   */
  readonly modeDefault: string | undefined;
  /**
   * Forward-compat for A.5 (model route / tier label). Not wired to env yet.
   */
  readonly modelRouteDefault: string | undefined;
}

/** Exported for tests; production uses `workflowRuntimeConfig` snapshot below. */
export function parseWorkflowRuntimeConfig(
  env: NodeJS.ProcessEnv,
): WorkflowRuntimeConfig {
  const debugAssistant = env.VIPER_DEBUG_ASSISTANT === "1";
  const debugWorkflow = env.VIPER_DEBUG_WORKFLOW === "1";
  const enableStreamContextPrimer =
    (env.VIPER_ENABLE_STREAM_CONTEXT_PRIMER ?? "true").toLowerCase() !== "false";
  const streamAnalysisWarmupMs = Math.max(
    0,
    parseInt(env.VIPER_STREAM_ANALYSIS_WARMUP_MS ?? "2500", 10),
  );
  const requireAnalysisForEdits =
    (env.VIPER_REQUIRE_ANALYSIS_FOR_EDITS ?? "false").toLowerCase() === "true";
  const minFilesReadBeforeEdit = Math.max(
    0,
    parseInt(env.VIPER_MIN_FILES_READ_BEFORE_EDIT ?? "2", 10),
  );
  const minDiscoveryToolsBeforeEdit = Math.max(
    0,
    parseInt(env.VIPER_MIN_DISCOVERY_TOOLS_BEFORE_EDIT ?? "1", 10),
  );
  const openaiModel = env.OPENAI_MODEL ?? "gpt-4o-mini";
  const disableLlmCache = (env.DISABLE_LLM_CACHE ?? "false").toLowerCase() === "true";
  const directLlmCacheTtl = disableLlmCache
    ? 0
    : Math.max(0, parseInt(env.DIRECT_LLM_CACHE_TTL ?? "900", 10));
  const chatHistoryLimit = Math.max(
    0,
    Math.min(10, parseInt(env.CHAT_HISTORY_LIMIT ?? "10", 10)),
  );
  const runAnalysisWaitMs = Math.max(
    0,
    parseInt(env.RUN_ANALYSIS_WAIT_MS ?? "12000", 10),
  );

  return {
    debugAssistant,
    debugWorkflow,
    enableStreamContextPrimer,
    streamAnalysisWarmupMs,
    requireAnalysisForEdits,
    minFilesReadBeforeEdit,
    minDiscoveryToolsBeforeEdit,
    openaiModel,
    disableLlmCache,
    directLlmCacheTtl,
    chatHistoryLimit,
    runAnalysisWaitMs,
    modeDefault: undefined,
    modelRouteDefault: undefined,
  };
}

/**
 * Eager snapshot at module load — matches prior behavior where assistant.service used
 * top-level `const` from process.env (read once when the module graph first loads).
 */
export const workflowRuntimeConfig: WorkflowRuntimeConfig =
  parseWorkflowRuntimeConfig(process.env);
