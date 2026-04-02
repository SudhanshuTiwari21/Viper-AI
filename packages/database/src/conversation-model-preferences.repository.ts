import type { Pool } from "pg";

export type ConversationModelTier = "auto" | "premium" | "fast";

export async function upsertConversationModelPreference(
  pool: Pool,
  params: {
    workspace_id: string;
    conversation_id: string;
    model_tier: ConversationModelTier;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO conversation_model_preferences (workspace_id, conversation_id, model_tier, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (workspace_id, conversation_id)
     DO UPDATE SET model_tier = EXCLUDED.model_tier, updated_at = now()`,
    [params.workspace_id, params.conversation_id, params.model_tier],
  );
}

export async function getConversationModelPreference(
  pool: Pool,
  workspace_id: string,
  conversation_id: string,
): Promise<ConversationModelTier | null> {
  const result = await pool.query<{ model_tier: ConversationModelTier }>(
    `SELECT model_tier FROM conversation_model_preferences
     WHERE workspace_id = $1 AND conversation_id = $2`,
    [workspace_id, conversation_id],
  );
  const row = result.rows[0];
  return row?.model_tier ?? null;
}
