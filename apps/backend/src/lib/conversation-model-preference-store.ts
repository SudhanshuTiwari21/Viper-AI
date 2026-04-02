import {
  getConversationModelPreference,
  upsertConversationModelPreference,
  type ConversationModelTier,
} from "@repo/database";
import { getPool } from "@repo/database";
import type { ModelTierSelection } from "../validators/request.schemas.js";

const memory = new Map<string, ConversationModelTier>();

function memKey(workspaceId: string, conversationId: string): string {
  return `${workspaceId}\0${conversationId}`;
}

/** Use Postgres when `DATABASE_URL` is set; otherwise in-memory (tests / no DB). */
function usePostgresPersistence(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function loadConversationModelPreference(
  workspaceId: string,
  conversationId: string,
): Promise<ModelTierSelection | null> {
  if (!usePostgresPersistence()) {
    return memory.get(memKey(workspaceId, conversationId)) ?? null;
  }
  try {
    const row = await getConversationModelPreference(getPool(), workspaceId, conversationId);
    return row;
  } catch {
    return memory.get(memKey(workspaceId, conversationId)) ?? null;
  }
}

export async function saveConversationModelPreference(
  workspaceId: string,
  conversationId: string,
  tier: ModelTierSelection,
): Promise<void> {
  const t = tier as ConversationModelTier;
  memory.set(memKey(workspaceId, conversationId), t);
  if (!usePostgresPersistence()) {
    return;
  }
  try {
    await upsertConversationModelPreference(getPool(), {
      workspace_id: workspaceId,
      conversation_id: conversationId,
      model_tier: t,
    });
  } catch {
    /* keep memory copy */
  }
}

/** Test helper: clear in-memory map. */
export function __clearConversationModelPreferenceMemoryForTests(): void {
  memory.clear();
}
