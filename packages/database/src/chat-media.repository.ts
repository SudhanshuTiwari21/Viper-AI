import type { Pool } from "pg";

export interface ChatMediaRow {
  id: string;
  workspace_id: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  storage_key: string;
  created_at: string;
  expires_at: string | null;
}

export async function insertChatMedia(
  pool: Pool,
  params: {
    id: string;
    workspace_id: string;
    mime_type: string;
    byte_size: number;
    sha256: string;
    storage_key: string;
    expires_at: Date | null;
  },
): Promise<ChatMediaRow> {
  const result = await pool.query<ChatMediaRow>(
    `INSERT INTO chat_media (id, workspace_id, mime_type, byte_size, sha256, storage_key, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      params.id,
      params.workspace_id,
      params.mime_type,
      params.byte_size,
      params.sha256,
      params.storage_key,
      params.expires_at ?? null,
    ],
  );
  return result.rows[0]!;
}

/**
 * Fetch a single media row; enforces workspace isolation (returns null if id exists
 * but workspace_id does not match).
 */
export async function getChatMedia(
  pool: Pool,
  id: string,
  workspace_id: string,
): Promise<ChatMediaRow | null> {
  const result = await pool.query<ChatMediaRow>(
    `SELECT * FROM chat_media WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
    [id, workspace_id],
  );
  return result.rows[0] ?? null;
}

/**
 * Delete a media row; enforces workspace isolation.
 * Returns true if a row was deleted.
 */
export async function deleteChatMedia(
  pool: Pool,
  id: string,
  workspace_id: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM chat_media WHERE id = $1 AND workspace_id = $2`,
    [id, workspace_id],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Returns rows whose expires_at is set and earlier than `now`. */
export async function listExpiredChatMedia(
  pool: Pool,
  now: Date,
): Promise<ChatMediaRow[]> {
  const result = await pool.query<ChatMediaRow>(
    `SELECT * FROM chat_media WHERE expires_at IS NOT NULL AND expires_at < $1`,
    [now.toISOString()],
  );
  return result.rows;
}
