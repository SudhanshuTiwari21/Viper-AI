import type { WorkflowRuntimeConfig } from "../config/workflow-flags.js";
import {
  loadConversationModelPreference,
  saveConversationModelPreference,
} from "./conversation-model-preference-store.js";
import { resolveTierWithEntitlements } from "./model-tier-entitlements.js";
import type { RequestIdentity } from "../types/request-identity.js";
import type { ChatRequest, ModelTierSelection } from "../validators/request.schemas.js";

export interface EffectiveModelTierResult {
  effective: ModelTierSelection;
  /** Tier after persistence merge, before entitlement downgrade. */
  requested: ModelTierSelection;
  downgraded: boolean;
  tier_downgraded_from?: ModelTierSelection;
  tier_downgraded_to?: ModelTierSelection;
  denyReason?: string;
}

/** True when the client sent a `modelTier` field (D.20 upsert + skip load). */
export function isModelTierExplicitInParsedBody(parsedBody: ChatRequest): boolean {
  return (
    "modelTier" in parsedBody &&
    parsedBody.modelTier !== undefined &&
    parsedBody.modelTier !== null
  );
}

/**
 * D.20: merge persisted preference, upsert on explicit body, apply entitlements.
 * Call from chat controller after Zod parse.
 */
export async function resolveEffectiveModelTier(params: {
  parsedBody: ChatRequest;
  identity: RequestIdentity;
  config: WorkflowRuntimeConfig;
}): Promise<EffectiveModelTierResult> {
  const explicit = isModelTierExplicitInParsedBody(params.parsedBody);
  const { identity, config } = params;
  const parsedModelTier = params.parsedBody.modelTier;

  let requested: ModelTierSelection;
  if (explicit && parsedModelTier !== undefined) {
    requested = parsedModelTier;
    if (identity.conversation_id) {
      await saveConversationModelPreference(
        identity.workspace_id,
        identity.conversation_id,
        requested,
      );
    }
  } else if (identity.conversation_id) {
    const persisted = await loadConversationModelPreference(
      identity.workspace_id,
      identity.conversation_id,
    );
    requested = persisted ?? "auto";
  } else {
    requested = "auto";
  }

  const r = resolveTierWithEntitlements(requested, params.config.entitledModelTiers);
  const denyReason = r.downgraded
    ? `tier_not_entitled:${r.tier_downgraded_from}->${r.tier_downgraded_to}`
    : undefined;

  return {
    effective: r.effective,
    requested,
    downgraded: r.downgraded,
    tier_downgraded_from: r.tier_downgraded_from,
    tier_downgraded_to: r.tier_downgraded_to,
    denyReason,
  };
}
