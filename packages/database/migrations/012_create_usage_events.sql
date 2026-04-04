-- F.31: usage_events — append-only billing-grade record per chat HTTP request.
--
-- Design notes:
--  * Append-only: the application NEVER issues UPDATE on this table.
--    Corrections are done by inserting a new row with corrected fields.
--  * UNIQUE(request_id) enforces one row per HTTP request; conflict is
--    silently swallowed (ON CONFLICT DO NOTHING) for idempotent re-ingestion.
--  * workspace_path_key is the 16-hex string from deriveWorkspaceId(), the
--    existing billing anchor used by chat_feedback, chat_media, etc.
--  * workspace_uuid / user_uuid are populated only when F.30 entitlement
--    resolution succeeds; nullable so local/anonymous mode is unchanged.
--  * input_tokens / output_tokens / total_tokens are nullable: the non-stream
--    path populates them from the OpenAI response `usage` object when present;
--    the stream path currently sets them to NULL (see F.31 docs — deferred
--    until streaming usage deltas are aggregated in F.32+).
--  * tool_call_count is nullable: populated on the agentic path from
--    RouteMeta.fallback_chain length proxy (tool rounds are tracked separately
--    in the agentic loop — full instrumentation deferred to F.32).
--  * metadata JSONB stores stream:true|false, fallover_chain, and any future
--    extensibility fields without a schema migration.

CREATE TABLE IF NOT EXISTS usage_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  request_id          TEXT        NOT NULL,
  workspace_path_key  TEXT        NOT NULL,
  workspace_uuid      UUID        NULL,
  user_uuid           UUID        NULL,
  conversation_id     TEXT        NULL,

  mode                TEXT        NOT NULL,
  intent              TEXT        NOT NULL,
  provider            TEXT        NOT NULL,
  primary_model_id    TEXT        NOT NULL,
  final_model_id      TEXT        NOT NULL,
  route_mode          TEXT        NOT NULL,
  effective_model_tier TEXT       NOT NULL,
  tier_downgraded     BOOLEAN     NOT NULL,
  fallback_count      INT         NOT NULL,
  latency_ms          INT         NOT NULL,

  input_tokens        INT         NULL,
  output_tokens       INT         NULL,
  total_tokens        INT         NULL,
  tool_call_count     INT         NULL,

  metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT usage_events_request_id_uq UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_usage_events_workspace_occurred
  ON usage_events (workspace_path_key, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_occurred
  ON usage_events (occurred_at DESC);
