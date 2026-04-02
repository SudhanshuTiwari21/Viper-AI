/**
 * D.21 — Structured route telemetry emitted once per request.
 * Same shape is used for: workflowLog("model:route:outcome"), SSE `model:route:summary`,
 * and POST `routeTelemetry` (non-stream).
 */
export interface RouteTelemetry {
  request_id: string;
  workspace_id: string;
  conversation_id: string | null;
  mode: string;
  effective_model_tier: string;
  primary_model_id: string;
  final_model_id: string;
  fallback_chain: string[];
  fallback_count: number;
  intent: string;
  route_mode: string;
  tier_downgraded: boolean;
  latency_ms: number;
}

/**
 * Subset populated by the assistant pipeline (routing + failover tracking).
 * The controller merges identity + tier info to produce the full `RouteTelemetry`.
 */
export interface RouteMeta {
  primary_model_id: string;
  final_model_id: string;
  fallback_chain: string[];
  fallback_count: number;
  intent: string;
  route_mode: string;
  route_reason: string;
}

export function buildRouteTelemetry(params: {
  identity: { request_id: string; workspace_id: string; conversation_id: string | null };
  mode: string;
  effectiveModelTier: string;
  tierDowngraded: boolean;
  routeMeta: RouteMeta;
  latencyMs: number;
}): RouteTelemetry {
  return {
    request_id: params.identity.request_id,
    workspace_id: params.identity.workspace_id,
    conversation_id: params.identity.conversation_id,
    mode: params.mode,
    effective_model_tier: params.effectiveModelTier,
    primary_model_id: params.routeMeta.primary_model_id,
    final_model_id: params.routeMeta.final_model_id,
    fallback_chain: params.routeMeta.fallback_chain,
    fallback_count: params.routeMeta.fallback_count,
    intent: params.routeMeta.intent,
    route_mode: params.routeMeta.route_mode,
    tier_downgraded: params.tierDowngraded,
    latency_ms: params.latencyMs,
  };
}
