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
 * - OPENAI_MODEL — default gpt-4o-mini (OpenAI ids; Anthropic registry ids fall back to fast OpenAI until adapter ships)
 * - ANTHROPIC_API_KEY / VIPER_ANTHROPIC_CHAT_ENABLED — reserved for upcoming Anthropic Messages API wiring (see docs/ENV.md)
 * - VIPER_MODEL_ROUTE_DEFAULT — `pinned`|`auto`, default **pinned** (D.17).
 * - VIPER_MODEL_FAILOVER_MAX_ATTEMPTS — int **1–5**, default **3**: max **total** model tries (primary + fallbacks, deduped order).
 * - VIPER_MODEL_FAILOVER_ENABLED — optional `true`|`false`|`1`|`0`. Unset ⇒ failover **on** when route default is `auto`, **off** when `pinned`.
 * - VIPER_ALLOWED_MODEL_TIERS — D.20: comma-separated `auto`|`fast`|`premium`; default all three; invalid tokens ignored.
 * - VIPER_PREMIUM_REQUIRES_ENTITLEMENT — D.20: default false; when true, premium requires `VIPER_PREMIUM_ENTITLED` truthy.
 * - VIPER_PREMIUM_ENTITLED — D.20: default true; set false/0 to deny premium when premium gate is on.
 * - VIPER_MODEL_TELEMETRY — D.21: "1" emits a structured JSON line to stdout per request (route outcome telemetry) for ops scraping without full debug.
 * - DISABLE_LLM_CACHE — default false unless lowercase is "true"
 * - DIRECT_LLM_CACHE_TTL — int, default 900, Math.max(0, …); forced 0 when DISABLE_LLM_CACHE
 * - CHAT_HISTORY_LIMIT — int, default 10, clamped Math.max(0, Math.min(10, …))
 * - RUN_ANALYSIS_WAIT_MS — int, default 12000, Math.max(0, …)
 * - VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS — float in [0, 1], default 0 (off). Non-finite or
 *   out-of-range values clamp to [0, 1]; invalid parse falls back to 0 (B.7).
 * - VIPER_ENABLE_POST_EDIT_VALIDATION — default false unless lowercase is "true" (B.8).
 * - VIPER_POST_EDIT_VALIDATION_COMMAND — trimmed shell string; when empty, defaults to
 *   `npm run check-types` (used only when post-edit validation is enabled).
 * - VIPER_POST_EDIT_VALIDATION_TIMEOUT_MS — int, default 30000, Math.max(0, …); bounds `runWorkspaceCommand`.
 * - VIPER_ENABLE_POST_EDIT_AUTO_REPAIR — default false unless lowercase is "true" (B.9). Only runs after a failed post-edit validation when B.8 is enabled.
 * - VIPER_POST_EDIT_AUTO_REPAIR_COMMAND — trimmed shell string; **empty** = repair skipped (explicit SSE + logs; no extra validation retry).
 * - VIPER_POST_EDIT_AUTO_REPAIR_MAX_EXTRA_VALIDATION_RUNS — int clamped **1–3**, default **1**. Semantics: after the **first** validation fails, at most this many **(repair → re-validate)** cycles run. **Max validation runs total** = **1 initial + maxExtra** (e.g. default 1 ⇒ at most **2** `validation:*` rounds, **1** repair execution if command is non-empty).
 * - VIPER_POST_EDIT_AUTO_REPAIR_TIMEOUT_MS — int, default **same numeric default as** `VIPER_POST_EDIT_VALIDATION_TIMEOUT_MS` (30000) when unset; Math.max(0, …); bounds repair `runWorkspaceCommand`.
 *
 * Debug HTTP (A.5) — not part of assistant parsing above:
 * - VIPER_EXPOSE_WORKFLOW_DEBUG — "1" exposes GET /debug/workflow-policy; default off (404)
 */

import { getDefaultModelForTier, resolveModelSpec } from "@repo/model-registry";
import type { ModelTierSelection } from "../validators/request.schemas.js";
import {
  buildEntitledTierSet,
  parseAllowedModelTiersFromEnv,
  parsePremiumEntitled,
  parsePremiumRequiresEntitlement,
} from "../lib/model-tier-entitlements.js";

export interface WorkflowRuntimeConfig {
  readonly debugAssistant: boolean;
  readonly debugWorkflow: boolean;
  readonly enableStreamContextPrimer: boolean;
  readonly streamAnalysisWarmupMs: number;
  readonly requireAnalysisForEdits: boolean;
  readonly minFilesReadBeforeEdit: number;
  readonly minDiscoveryToolsBeforeEdit: number;
  /** Raw env value for backwards compatibility (may be unknown). */
  readonly openaiModel: string;
  /** D.16: resolved model id from the registry (always known). */
  readonly resolvedModelId: string;
  readonly resolvedModelProvider: string;
  readonly resolvedModelTier: string;
  /** D.17: model router default mode (preserve existing behavior by default). */
  readonly modelRouteDefault: "pinned" | "auto";
  /**
   * D.18: max **total** model attempts in a failover sequence (primary + fallbacks), clamped 1–5.
   * Default **3** (primary plus up to two fallbacks if the chain lists them).
   */
  readonly modelFailoverMaxAttempts: number;
  /**
   * D.18: when `true` / `false`, forces failover on or off for **all** route modes.
   * When `undefined`, failover defaults to **on** for `modelRouteDefault=auto` and **off** for `pinned`.
   */
  readonly modelFailoverEnabledOverride: boolean | undefined;
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
  readonly modelRouteLabelDefault: string | undefined;
  /** B.7: min hybrid retrieval `overall` to allow edits; 0 = disabled. */
  readonly minRetrievalConfidenceForEdits: number;
  /** B.8: run a workspace command after successful edit/create tools. */
  readonly enablePostEditValidation: boolean;
  /** B.8: command string (trimmed); empty → `npm run check-types` when validation is enabled. */
  readonly postEditValidationCommand: string;
  /** B.8: timeout for `runWorkspaceCommand` during post-edit validation. */
  readonly postEditValidationTimeoutMs: number;
  /** B.9: bounded shell auto-repair after validation failure. */
  readonly enablePostEditAutoRepair: boolean;
  readonly postEditAutoRepairCommand: string;
  /** B.9: 1–3 repair→re-validate cycles after first failure (see header). */
  readonly postEditAutoRepairMaxExtraValidationRuns: number;
  readonly postEditAutoRepairTimeoutMs: number;
  /**
   * D.20: tiers allowed after env list + optional premium entitlement gate.
   * Used by `resolveEffectiveModelTier` for downgrade decisions.
   */
  readonly entitledModelTiers: ReadonlySet<ModelTierSelection>;
  /**
   * D.21: emit structured JSON route telemetry to stdout per request for ops scraping.
   */
  readonly modelTelemetry: boolean;
  /**
   * H.44: when true, the auto routing path also runs the candidate policy and emits
   * router:shadow:compare via workflowLog. Live model is unchanged.
   * Requires VIPER_DEBUG_ASSISTANT=1 or VIPER_DEBUG_WORKFLOW=1 to surface in logs.
   */
  readonly routerShadowEnabled: boolean;
  /**
   * H.44: fraction of auto-routed requests (0–100) that use the candidate policy as the
   * *live* routing decision (real staged rollout, not shadow-only).
   * Bucketing is deterministic on workspaceKey+conversationId — same workspace sees stable behavior.
   * 0 = off (default). 100 = full rollout.
   */
  readonly routerPolicyCandidatePct: number;
}

/**
 * Parse B.7 threshold: [0, 1], default 0. NaN / non-finite → 0; out of range → clamped.
 */
export function parseMinRetrievalConfidenceForEdits(env: NodeJS.ProcessEnv): number {
  const raw = env.VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS;
  if (raw === undefined || raw === "") return 0;
  const n = Number.parseFloat(String(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** B.9: clamp 1–3; invalid/non-finite → 1. */
export function parsePostEditAutoRepairMaxExtraValidationRuns(env: NodeJS.ProcessEnv): number {
  const n = parseInt(env.VIPER_POST_EDIT_AUTO_REPAIR_MAX_EXTRA_VALIDATION_RUNS ?? "1", 10);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(3, n));
}

/** D.18: clamped 1–5; default 3 total attempts (primary + fallbacks). */
export function parseModelFailoverMaxAttempts(env: NodeJS.ProcessEnv): number {
  const n = parseInt(env.VIPER_MODEL_FAILOVER_MAX_ATTEMPTS ?? "3", 10);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, n));
}

/** H.44: clamp 0–100; NaN/invalid → 0 (off by default). */
export function parseRouterPolicyCandidatePct(env: NodeJS.ProcessEnv): number {
  const raw = env.VIPER_ROUTER_POLICY_CANDIDATE_PCT;
  if (raw === undefined || raw === "") return 0;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** D.18: explicit enable/disable; invalid values treated as unset. */
export function parseModelFailoverEnabledOverride(env: NodeJS.ProcessEnv): boolean | undefined {
  const raw = env.VIPER_MODEL_FAILOVER_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return undefined;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return undefined;
}

export function modelFailoverEnabledForRoute(
  override: boolean | undefined,
  routeMode: "pinned" | "auto",
): boolean {
  if (override !== undefined) return override;
  return routeMode === "auto";
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
  let resolved = resolveModelSpec(openaiModel) ?? getDefaultModelForTier("fast");
  // Anthropic ids exist in @repo/model-registry for metering/docs; chat is still OpenAI-native.
  if (resolved.provider === "anthropic") {
    resolved = getDefaultModelForTier("fast");
  }
  const modelRouteDefaultRaw = (env.VIPER_MODEL_ROUTE_DEFAULT ?? "pinned").trim().toLowerCase();
  const modelRouteDefault =
    modelRouteDefaultRaw === "auto" ? "auto" : ("pinned" as const);
  const modelFailoverMaxAttempts = parseModelFailoverMaxAttempts(env);
  const modelFailoverEnabledOverride = parseModelFailoverEnabledOverride(env);
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
  const minRetrievalConfidenceForEdits = parseMinRetrievalConfidenceForEdits(env);

  const enablePostEditValidation =
    (env.VIPER_ENABLE_POST_EDIT_VALIDATION ?? "false").toLowerCase() === "true";
  const postEditValidationCommandRaw = (env.VIPER_POST_EDIT_VALIDATION_COMMAND ?? "").trim();
  const postEditValidationCommand =
    postEditValidationCommandRaw !== "" ? postEditValidationCommandRaw : "npm run check-types";
  const postEditValidationTimeoutMs = Math.max(
    0,
    parseInt(env.VIPER_POST_EDIT_VALIDATION_TIMEOUT_MS ?? "30000", 10),
  );

  const enablePostEditAutoRepair =
    (env.VIPER_ENABLE_POST_EDIT_AUTO_REPAIR ?? "false").toLowerCase() === "true";
  const postEditAutoRepairCommand = (env.VIPER_POST_EDIT_AUTO_REPAIR_COMMAND ?? "").trim();
  const postEditAutoRepairMaxExtraValidationRuns = parsePostEditAutoRepairMaxExtraValidationRuns(env);
  const postEditAutoRepairTimeoutMs = Math.max(
    0,
    parseInt(
      env.VIPER_POST_EDIT_AUTO_REPAIR_TIMEOUT_MS ?? String(postEditValidationTimeoutMs),
      10,
    ),
  );

  const modelTelemetry = env.VIPER_MODEL_TELEMETRY === "1";

  // H.44 router shadow + staged rollout
  const routerShadowEnabledRaw = env.VIPER_ROUTER_SHADOW_ENABLED ?? "";
  const routerShadowEnabled =
    routerShadowEnabledRaw === "1" || routerShadowEnabledRaw.toLowerCase() === "true";
  const routerPolicyCandidatePct = parseRouterPolicyCandidatePct(env);

  const allowedModelTiers = parseAllowedModelTiersFromEnv(env);
  const premiumRequiresEntitlement = parsePremiumRequiresEntitlement(env);
  const premiumEntitled = parsePremiumEntitled(env);
  const entitledModelTiers = buildEntitledTierSet({
    allowedFromEnv: allowedModelTiers,
    premiumRequiresEntitlement,
    premiumEntitled,
  });

  return {
    debugAssistant,
    debugWorkflow,
    enableStreamContextPrimer,
    streamAnalysisWarmupMs,
    requireAnalysisForEdits,
    minFilesReadBeforeEdit,
    minDiscoveryToolsBeforeEdit,
    openaiModel,
    resolvedModelId: resolved.id,
    resolvedModelProvider: resolved.provider,
    resolvedModelTier: resolved.tier,
    modelRouteDefault,
    modelFailoverMaxAttempts,
    modelFailoverEnabledOverride,
    disableLlmCache,
    directLlmCacheTtl,
    chatHistoryLimit,
    runAnalysisWaitMs,
    modeDefault: undefined,
    modelRouteLabelDefault: undefined,
    minRetrievalConfidenceForEdits,
    enablePostEditValidation,
    postEditValidationCommand,
    postEditValidationTimeoutMs,
    enablePostEditAutoRepair,
    postEditAutoRepairCommand,
    postEditAutoRepairMaxExtraValidationRuns,
    postEditAutoRepairTimeoutMs,
    entitledModelTiers,
    modelTelemetry,
    routerShadowEnabled,
    routerPolicyCandidatePct,
  };
}

/**
 * Eager snapshot at module load — matches prior behavior where assistant.service used
 * top-level `const` from process.env (read once when the module graph first loads).
 */
export const workflowRuntimeConfig: WorkflowRuntimeConfig =
  parseWorkflowRuntimeConfig(process.env);
