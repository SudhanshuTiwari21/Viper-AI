/**
 * F.31 — Usage event emitter.
 *
 * Records one append-only usage event per chat HTTP request (non-stream and stream).
 * Used for later billing reconciliation (F.32–F.34).
 *
 * Kill-switches (env):
 *   VIPER_USAGE_EVENTS=1   — enable DB insert (default off; zero DB work otherwise)
 *   VIPER_USAGE_EVENTS_STDOUT=1 — emit a JSON line to stdout per event regardless of
 *                                  DB switch (useful for log pipelines)
 *
 * DB idempotency:
 *   insertUsageEvent uses ON CONFLICT (request_id) DO NOTHING, so duplicate
 *   calls for the same request_id are silently swallowed.
 *
 * Token accounting in F.31:
 *   - Non-stream path: `usageTokens` populated when the OpenAI response includes
 *     a `usage` object (passed in via params.tokens).
 *   - Stream path: tokens set to null — streaming usage deltas are not yet
 *     aggregated (deferred to F.32+ or when stream-usage is wired in the SDK).
 *
 * Provider resolution:
 *   Derived from the @repo/model-registry spec for finalModelId.
 *   Falls back to "openai" when the model is not in the registry.
 */

import { getPool, insertUsageEvent } from "@repo/database";
import type { UsageBillingBucket } from "@repo/database";
import { resolveModelSpec, computeUsageCostUnits } from "@repo/model-registry";
import { workflowLog } from "../services/assistant.service.js";
import type { RouteTelemetry } from "../types/route-telemetry.js";
import type { ResolvedEntitlements } from "./entitlements.service.js";

// ---------------------------------------------------------------------------
// Env helpers (evaluated at call time so tests can mutate process.env)
// ---------------------------------------------------------------------------

export function isUsageEventsEnabled(): boolean {
  const v = process.env["VIPER_USAGE_EVENTS"];
  return v === "1" || v?.toLowerCase() === "true";
}

export function isUsageEventsStdoutEnabled(): boolean {
  const v = process.env["VIPER_USAGE_EVENTS_STDOUT"];
  return v === "1" || v?.toLowerCase() === "true";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageEventTokens {
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
}

export interface RecordUsageEventParams {
  /** Full RouteTelemetry snapshot produced by buildRouteTelemetry(). */
  telemetry: RouteTelemetry;
  /** Whether this was a streaming request (stored in metadata). */
  stream: boolean;
  /** F.30 entitlements when resolved; null in unauthenticated/local mode. */
  entitlements: ResolvedEntitlements | null;
  /** Token counts from the final OpenAI completion (null on stream path). */
  tokens?: UsageEventTokens | null;
  /** Number of tool call rounds (null when not instrumented). */
  tool_call_count?: number | null;
  /** Request identity for workflowLog (already in telemetry but explicit here). */
  identity: { request_id: string; workspace_id: string; conversation_id: string | null };
  /** Product billing bucket for credit quotas (matches resolved chat `modelTier`). */
  billing_bucket: UsageBillingBucket;
}

// ---------------------------------------------------------------------------
// Core emitter
// ---------------------------------------------------------------------------

/**
 * Record one billing-grade usage event.
 *
 * - When VIPER_USAGE_EVENTS is off: only emits stdout line if VIPER_USAGE_EVENTS_STDOUT=1.
 *   No DB writes, no latency impact.
 * - When VIPER_USAGE_EVENTS=1 and DATABASE_URL is set: inserts into usage_events.
 * - On insert conflict (duplicate request_id): silently no-ops (idempotent).
 * - Errors from DB insert are caught and logged as warnings (never crash the request).
 */
function streamingAssumedTotalTokens(): number {
  const raw = process.env["VIPER_USAGE_STREAMING_ASSUMED_TOKENS"];
  if (!raw || raw.trim() === "") return 4096;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 4096;
}

export async function recordUsageEvent(params: RecordUsageEventParams): Promise<void> {
  const { telemetry, stream, entitlements, tokens, tool_call_count, identity, billing_bucket } =
    params;

  // Derive provider from model registry; fall back to "openai".
  const provider = resolveModelSpec(telemetry.final_model_id)?.provider ?? "openai";

  const cost_units = computeUsageCostUnits({
    modelId: telemetry.final_model_id,
    inputTokens: tokens?.input_tokens,
    outputTokens: tokens?.output_tokens,
    totalTokens: tokens?.total_tokens,
    assumedTotalTokensWhenUnknown: stream ? streamingAssumedTotalTokens() : 2048,
  });

  const eventData = {
    request_id: telemetry.request_id,
    workspace_path_key: telemetry.workspace_id,
    workspace_uuid: entitlements?.workspaceId ?? null,
    user_uuid: entitlements?.userId ?? null,
    conversation_id: telemetry.conversation_id,
    mode: telemetry.mode,
    intent: telemetry.intent,
    provider,
    primary_model_id: telemetry.primary_model_id,
    final_model_id: telemetry.final_model_id,
    route_mode: telemetry.route_mode,
    effective_model_tier: telemetry.effective_model_tier,
    tier_downgraded: telemetry.tier_downgraded,
    fallback_count: telemetry.fallback_count,
    latency_ms: telemetry.latency_ms,
    input_tokens: tokens?.input_tokens ?? null,
    output_tokens: tokens?.output_tokens ?? null,
    total_tokens: tokens?.total_tokens ?? null,
    tool_call_count: tool_call_count ?? null,
    billing_bucket,
    cost_units,
    metadata: {
      stream,
      fallback_chain: telemetry.fallback_chain,
    } as Record<string, unknown>,
  };

  // Stdout path — always runs first if enabled, independently of DB.
  if (isUsageEventsStdoutEnabled()) {
    const line = {
      _type: "viper.usage.event",
      ts: new Date().toISOString(),
      ...eventData,
    };
    process.stdout.write(
      JSON.stringify(line, (_key, value) => (typeof value === "bigint" ? value.toString() : value)) + "\n",
    );
  }

  // DB path — only when kill-switch is on AND a DB connection is available.
  if (!isUsageEventsEnabled()) {
    workflowLog("usage:event:skipped", identity, { reason: "VIPER_USAGE_EVENTS not set" });
    return;
  }

  if (!process.env["DATABASE_URL"]) {
    workflowLog("usage:event:skipped", identity, { reason: "no DATABASE_URL" });
    return;
  }

  try {
    const pool = getPool();
    const inserted = await insertUsageEvent(pool, eventData);
    workflowLog("usage:event:emitted", identity, {
      inserted: inserted !== null,
      request_id: telemetry.request_id,
      stream,
    });
  } catch (err) {
    // Never propagate — billing event failure must not crash the chat request.
    workflowLog("usage:event:skipped", identity, {
      reason: "db_error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
