import type { Pool } from "pg";

export interface ConversationMemoryRow {
  id: string;
  workspace_path: string;
  conversation_id: string;
  entry_type: string;
  content: string;
  meta: Record<string, unknown>;
  weight: number;
  created_at: Date;
}

export async function insertMemoryEntry(
  pool: Pool,
  entry: Omit<ConversationMemoryRow, "id" | "created_at">,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO conversation_memory (workspace_path, conversation_id, entry_type, content, meta, weight)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      entry.workspace_path,
      entry.conversation_id,
      entry.entry_type,
      entry.content,
      JSON.stringify(entry.meta),
      entry.weight,
    ],
  );
  return result.rows[0]!.id;
}

export async function getMemoryEntriesBySession(
  pool: Pool,
  workspacePath: string,
  conversationId: string,
  limit = 50,
): Promise<ConversationMemoryRow[]> {
  const result = await pool.query<ConversationMemoryRow>(
    `SELECT id, workspace_path, conversation_id, entry_type, content, meta, weight, created_at
     FROM conversation_memory
     WHERE workspace_path = $1 AND conversation_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [workspacePath, conversationId, limit],
  );
  return result.rows;
}

export async function getRecentMemoryByWorkspace(
  pool: Pool,
  workspacePath: string,
  entryTypes: string[],
  limit = 30,
): Promise<ConversationMemoryRow[]> {
  const result = await pool.query<ConversationMemoryRow>(
    `SELECT id, workspace_path, conversation_id, entry_type, content, meta, weight, created_at
     FROM conversation_memory
     WHERE workspace_path = $1 AND entry_type = ANY($2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [workspacePath, entryTypes, limit],
  );
  return result.rows;
}

export async function searchMemoryByKeywords(
  pool: Pool,
  workspacePath: string,
  keywords: string[],
  limit = 20,
): Promise<ConversationMemoryRow[]> {
  if (keywords.length === 0) return [];
  const pattern = keywords.map((k) => k.replace(/[%_]/g, "")).join("|");
  const result = await pool.query<ConversationMemoryRow>(
    `SELECT id, workspace_path, conversation_id, entry_type, content, meta, weight, created_at
     FROM conversation_memory
     WHERE workspace_path = $1 AND content ~* $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [workspacePath, pattern, limit],
  );
  return result.rows;
}
