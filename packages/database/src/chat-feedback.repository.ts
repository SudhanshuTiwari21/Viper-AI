import type { Pool } from "pg";

export type FeedbackRating = "up" | "down";

export interface ChatFeedbackRow {
  id: string;
  workspace_id: string;
  request_id: string;
  message_id: string | null;
  rating: FeedbackRating;
  tags: string[];
  comment: string | null;
  created_at: string;
}

export async function insertChatFeedback(
  pool: Pool,
  params: {
    workspace_id: string;
    request_id: string;
    message_id?: string | null;
    rating: FeedbackRating;
    tags?: string[];
    comment?: string | null;
  },
): Promise<ChatFeedbackRow> {
  const result = await pool.query<ChatFeedbackRow>(
    `INSERT INTO chat_feedback (workspace_id, request_id, message_id, rating, tags, comment)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.workspace_id,
      params.request_id,
      params.message_id ?? null,
      params.rating,
      params.tags ?? [],
      params.comment ?? null,
    ],
  );
  return result.rows[0]!;
}

export interface FeedbackStats {
  up: number;
  down: number;
  total: number;
}

export async function getChatFeedbackStats(
  pool: Pool,
  workspace_id: string,
  since?: Date,
): Promise<FeedbackStats> {
  const sinceClause = since ? `AND created_at >= $2` : "";
  const params: unknown[] = [workspace_id];
  if (since) params.push(since.toISOString());

  const result = await pool.query<{ rating: string; cnt: string }>(
    `SELECT rating, COUNT(*)::text AS cnt
     FROM chat_feedback
     WHERE workspace_id = $1 ${sinceClause}
     GROUP BY rating`,
    params,
  );

  let up = 0;
  let down = 0;
  for (const row of result.rows) {
    if (row.rating === "up") up = parseInt(row.cnt, 10);
    else if (row.rating === "down") down = parseInt(row.cnt, 10);
  }
  return { up, down, total: up + down };
}
