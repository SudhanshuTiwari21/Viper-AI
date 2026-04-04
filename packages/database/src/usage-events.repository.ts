/**
 * F.31 — Repository for the `usage_events` append-only table.
 *
 * Rules:
 *  - Never UPDATE rows — append only.
 *  - UNIQUE(request_id) is enforced at DB level; insertUsageEvent silently
 *    swallows conflict (ON CONFLICT DO NOTHING) for idempotent re-insertion.
 *  - billing_bucket + cost_units: credit-based quota (see VIPER_USAGE_AND_REVENUE_MODEL.md).
 */
import type { Pool } from "pg";

export type UsageBillingBucket = "auto" | "premium";

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
  billing_bucket: UsageBillingBucket | null;
  cost_units: string;
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
  billing_bucket?: UsageBillingBucket | null;
  cost_units?: bigint | number | string;
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
  const costUnits =
    typeof params.cost_units === "bigint"
      ? params.cost_units.toString()
      : params.cost_units != null
        ? String(params.cost_units)
        : "1";

  const result = await pool.query<UsageEventRow>(
    `INSERT INTO usage_events (
       request_id, workspace_path_key, workspace_uuid, user_uuid,
       conversation_id, mode, intent, provider,
       primary_model_id, final_model_id, route_mode,
       effective_model_tier, tier_downgraded, fallback_count, latency_ms,
       input_tokens, output_tokens, total_tokens, tool_call_count,
       billing_bucket, cost_units, metadata
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11,
       $12, $13, $14, $15,
       $16, $17, $18, $19,
       $20, $21::bigint, $22::jsonb
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
      params.billing_bucket ?? null,
      costUnits,
      JSON.stringify(params.metadata ?? {}),
    ],
  );
  return result.rows[0] ?? null;
}

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
 */
export async function countUsageEventsForDay(
  pool: Pool,
  workspacePathKey: string,
  dayUtc: string,
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

/**
 * Sum cost_units for a workspace in the UTC calendar month containing `todayUtc` ("YYYY-MM-DD").
 */
export async function sumCostUnitsForWorkspaceMonth(
  pool: Pool,
  workspacePathKey: string,
  billingBucket: UsageBillingBucket,
  todayUtc: string,
): Promise<bigint> {
  const result = await pool.query<{ s: string }>(
    `SELECT COALESCE(SUM(cost_units), 0)::text AS s
     FROM usage_events
     WHERE workspace_path_key = $1
       AND billing_bucket = $2
       AND occurred_at >= date_trunc('month', ($3::date)::timestamptz)
       AND occurred_at < date_trunc('month', ($3::date)::timestamptz) + interval '1 month'`,
    [workspacePathKey, billingBucket, todayUtc],
  );
  return BigInt(result.rows[0]?.s ?? "0");
}
