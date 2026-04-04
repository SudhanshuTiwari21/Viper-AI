/**
 * F.31 — Repository for the `usage_events` append-only table.
 *
 * Rules:
 *  - Never UPDATE rows — append only.
 *  - UNIQUE(request_id) is enforced at DB level; insertUsageEvent silently
 *    swallows conflict (ON CONFLICT DO NOTHING) for idempotent re-insertion.
 *  - Token columns (input_tokens, output_tokens, total_tokens) are nullable:
 *    * Non-stream path: populated when OpenAI response includes a `usage` object.
 *    * Stream path: NULL in F.31 — streaming usage deltas are not yet aggregated
 *      (deferred to F.32+, or until OpenAI stream-usage is wired).
 *  - tool_call_count: nullable; agentic paths will populate this in F.32 when
 *    tool-round counting is wired through RouteMeta.
 *  - metadata JSONB carries `stream: boolean`, `fallback_chain: string[]`,
 *    and any future extensibility without a schema migration.
 */
import type { Pool } from "pg";

export interface UsageEventRow {
  id: string;
  occurred_at: string;
  request_id: string;
  workspace_path_key: string;
  workspace_uuid: string | null;
  user_uuid: string | null;
  conversation_id: string | null;
  mode: string;
  intent: string;
  provider: string;
  primary_model_id: string;
  final_model_id: string;
  route_mode: string;
  effective_model_tier: string;
  tier_downgraded: boolean;
  fallback_count: number;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  tool_call_count: number | null;
  metadata: Record<string, unknown>;
}

export interface InsertUsageEventParams {
  request_id: string;
  workspace_path_key: string;
  workspace_uuid?: string | null;
  user_uuid?: string | null;
  conversation_id?: string | null;
  mode: string;
  intent: string;
  provider: string;
  primary_model_id: string;
  final_model_id: string;
  route_mode: string;
  effective_model_tier: string;
  tier_downgraded: boolean;
  fallback_count: number;
  latency_ms: number;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  tool_call_count?: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * Insert one usage event row.
 * Returns the inserted row, or null if the request_id already exists
 * (idempotent — ON CONFLICT DO NOTHING).
 */
export async function insertUsageEvent(
  pool: Pool,
  params: InsertUsageEventParams,
): Promise<UsageEventRow | null> {
  const result = await pool.query<UsageEventRow>(
    `INSERT INTO usage_events (
       request_id, workspace_path_key, workspace_uuid, user_uuid,
       conversation_id, mode, intent, provider,
       primary_model_id, final_model_id, route_mode,
       effective_model_tier, tier_downgraded, fallback_count, latency_ms,
       input_tokens, output_tokens, total_tokens, tool_call_count, metadata
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11,
       $12, $13, $14, $15,
       $16, $17, $18, $19, $20::jsonb
     )
     ON CONFLICT (request_id) DO NOTHING
     RETURNING *`,
    [
      params.request_id,
      params.workspace_path_key,
      params.workspace_uuid ?? null,
      params.user_uuid ?? null,
      params.conversation_id ?? null,
      params.mode,
      params.intent,
      params.provider,
      params.primary_model_id,
      params.final_model_id,
      params.route_mode,
      params.effective_model_tier,
      params.tier_downgraded,
      params.fallback_count,
      params.latency_ms,
      params.input_tokens ?? null,
      params.output_tokens ?? null,
      params.total_tokens ?? null,
      params.tool_call_count ?? null,
      JSON.stringify(params.metadata ?? {}),
    ],
  );
  return result.rows[0] ?? null;
}

/**
 * Fetch a single usage event by request_id (for tests / reconciliation).
 * Not used on the hot path.
 */
export async function getUsageEventByRequestId(
  pool: Pool,
  request_id: string,
): Promise<UsageEventRow | null> {
  const result = await pool.query<UsageEventRow>(
    `SELECT * FROM usage_events WHERE request_id = $1 LIMIT 1`,
    [request_id],
  );
  return result.rows[0] ?? null;
}

/**
 * F.33 — Count usage events for a workspace on the current UTC day.
 *
 * This is the "live tail" component of monthly quota computation:
 * because the aggregation job only processes closed days, the current
 * day's events are not yet in usage_rollups_daily and must be counted
 * directly from usage_events.
 *
 * todayUtc: the current UTC date as "YYYY-MM-DD" (caller supplies for testability).
 *
 * Returns a BigInt-safe string that should be parsed with parseInt() or BigInt().
 */
export async function countUsageEventsForDay(
  pool: Pool,
  workspacePathKey: string,
  dayUtc: string, // "YYYY-MM-DD"
): Promise<string> {
  const result = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt
     FROM usage_events
     WHERE workspace_path_key = $1
       AND occurred_at >= ($2::date)::timestamptz
       AND occurred_at <  ($2::date + INTERVAL '1 day')::timestamptz`,
    [workspacePathKey, dayUtc],
  );
  return result.rows[0]?.cnt ?? "0";
}
