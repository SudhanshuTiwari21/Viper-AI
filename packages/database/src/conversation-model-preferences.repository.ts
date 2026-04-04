import type { Pool } from "pg";

export type ConversationModelTier = "auto" | "premium";

export type ConversationModelPreferenceRow = {
  model_tier: ConversationModelTier;
  preferred_premium_model_id: string | null;
};

export async function upsertConversationModelPreference(
  pool: Pool,
  params: {
    workspace_id: string;
    conversation_id: string;
    model_tier: ConversationModelTier;
    preferred_premium_model_id?: string | null;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO conversation_model_preferences (
       workspace_id, conversation_id, model_tier, preferred_premium_model_id, updated_at
     )
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (workspace_id, conversation_id)
     DO UPDATE SET
       model_tier = EXCLUDED.model_tier,
       preferred_premium_model_id = EXCLUDED.preferred_premium_model_id,
       updated_at = now()`,
    [
      params.workspace_id,
      params.conversation_id,
      params.model_tier,
      params.preferred_premium_model_id ?? null,
    ],
  );
}

export async function getConversationModelPreference(
  pool: Pool,
  workspace_id: string,
  conversation_id: string,
): Promise<ConversationModelPreferenceRow | null> {
  const result = await pool.query<ConversationModelPreferenceRow>(
    `SELECT model_tier, preferred_premium_model_id
     FROM conversation_model_preferences
     WHERE workspace_id = $1 AND conversation_id = $2`,
    [workspace_id, conversation_id],
  );
  const row = result.rows[0];
  return row ?? null;
}
