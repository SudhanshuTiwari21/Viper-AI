import {
  insertChatFeedback,
  getChatFeedbackStats,
  type FeedbackRating,
  type FeedbackStats,
} from "@repo/database";
import { getPool } from "@repo/database";

export interface FeedbackEntry {
  workspace_id: string;
  request_id: string;
  message_id?: string | null;
  rating: FeedbackRating;
  tags?: string[];
  comment?: string | null;
}

const memory: FeedbackEntry[] = [];

function usePostgresPersistence(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function saveFeedback(entry: FeedbackEntry): Promise<void> {
  memory.push(entry);
  if (!usePostgresPersistence()) return;
  try {
    await insertChatFeedback(getPool(), entry);
  } catch {
    /* keep memory copy */
  }
}

export async function getFeedbackStats(
  workspace_id: string,
  since?: Date,
): Promise<FeedbackStats> {
  if (!usePostgresPersistence()) {
    let entries = memory.filter((e) => e.workspace_id === workspace_id);
    if (since) {
      const ts = since.getTime();
      entries = entries.filter((_, i) => i >= 0); // all in-memory entries (no timestamps)
      void ts; // in-memory has no created_at; return all matching workspace
    }
    let up = 0;
    let down = 0;
    for (const e of entries) {
      if (e.rating === "up") up++;
      else down++;
    }
    return { up, down, total: up + down };
  }
  try {
    return await getChatFeedbackStats(getPool(), workspace_id, since);
  } catch {
    let up = 0;
    let down = 0;
    for (const e of memory.filter((e) => e.workspace_id === workspace_id)) {
      if (e.rating === "up") up++;
      else down++;
    }
    return { up, down, total: up + down };
  }
}

export function __clearFeedbackMemoryForTests(): void {
  memory.length = 0;
}
