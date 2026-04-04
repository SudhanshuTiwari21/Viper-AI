import {
  getConversationModelPreference,
  upsertConversationModelPreference,
  type ConversationModelTier,
} from "@repo/database";
import { getPool } from "@repo/database";
import type { ModelTierSelection } from "../validators/request.schemas.js";

export type ConversationRoutingPreference = {
  modelTier: ModelTierSelection;
  preferredPremiumModelId: string | null;
};

const memory = new Map<string, ConversationRoutingPreference>();

function memKey(workspaceId: string, conversationId: string): string {
  return `${workspaceId}\0${conversationId}`;
}

function normalizeTier(t: string): ModelTierSelection {
  if (t === "premium") return "premium";
  return "auto";
}

/** Use Postgres when `DATABASE_URL` is set; otherwise in-memory (tests / no DB). */
function usePostgresPersistence(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function loadConversationRoutingPreference(
  workspaceId: string,
  conversationId: string,
): Promise<ConversationRoutingPreference | null> {
  if (!usePostgresPersistence()) {
    return memory.get(memKey(workspaceId, conversationId)) ?? null;
  }
  try {
    const row = await getConversationModelPreference(getPool(), workspaceId, conversationId);
    if (!row) return memory.get(memKey(workspaceId, conversationId)) ?? null;
    return {
      modelTier: normalizeTier(String(row.model_tier)),
      preferredPremiumModelId: row.preferred_premium_model_id,
    };
  } catch {
    return memory.get(memKey(workspaceId, conversationId)) ?? null;
  }
}

export async function saveConversationRoutingPreference(
  workspaceId: string,
  conversationId: string,
  pref: ConversationRoutingPreference,
): Promise<void> {
  const tier = pref.modelTier as ConversationModelTier;
  memory.set(memKey(workspaceId, conversationId), {
    modelTier: pref.modelTier,
    preferredPremiumModelId: pref.preferredPremiumModelId,
  });
  if (!usePostgresPersistence()) {
    return;
  }
  try {
    await upsertConversationModelPreference(getPool(), {
      workspace_id: workspaceId,
      conversation_id: conversationId,
      model_tier: tier,
      preferred_premium_model_id: pref.preferredPremiumModelId,
    });
  } catch {
    /* keep memory copy */
  }
}

/** Test helper: clear in-memory map. */
export function __clearConversationModelPreferenceMemoryForTests(): void {
  memory.clear();
}
