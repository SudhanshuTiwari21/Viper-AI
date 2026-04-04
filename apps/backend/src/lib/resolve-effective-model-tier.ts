import {
  getDefaultModelForTier,
  isPremiumSelectableModelId,
} from "@repo/model-registry";
import type { WorkflowRuntimeConfig } from "../config/workflow-flags.js";
import {
  loadConversationRoutingPreference,
  saveConversationRoutingPreference,
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
  /** OpenAI model id when `effective === "premium"`; otherwise null. */
  effectivePremiumModelId: string | null;
}

/** True when the client sent a `modelTier` field (D.20 upsert + skip load). */
export function isModelTierExplicitInParsedBody(parsedBody: ChatRequest): boolean {
  return (
    "modelTier" in parsedBody &&
    parsedBody.modelTier !== undefined &&
    parsedBody.modelTier !== null
  );
}

function isPremiumModelIdExplicitInParsedBody(parsedBody: ChatRequest): boolean {
  return (
    "premiumModelId" in parsedBody &&
    parsedBody.premiumModelId !== undefined &&
    parsedBody.premiumModelId !== null &&
    String(parsedBody.premiumModelId).trim() !== ""
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
  const explicitTier = isModelTierExplicitInParsedBody(params.parsedBody);
  const explicitPremiumId = isPremiumModelIdExplicitInParsedBody(params.parsedBody);
  const bodyPremiumRaw = explicitPremiumId ? String(params.parsedBody.premiumModelId).trim() : null;
  const bodyPremium =
    bodyPremiumRaw && isPremiumSelectableModelId(bodyPremiumRaw) ? bodyPremiumRaw : null;

  const defaultPremiumId = String(getDefaultModelForTier("premium").id);

  const { identity, config } = params;
  const parsedModelTier = params.parsedBody.modelTier;

  const persisted =
    identity.conversation_id != null && identity.conversation_id !== ""
      ? await loadConversationRoutingPreference(identity.workspace_id, identity.conversation_id)
      : null;

  let requested: ModelTierSelection;
  if (explicitTier && parsedModelTier !== undefined) {
    requested = parsedModelTier;
  } else if (identity.conversation_id) {
    requested = persisted?.modelTier ?? "auto";
  } else {
    requested = "auto";
  }

  const persistedPremiumOk =
    persisted?.preferredPremiumModelId &&
    isPremiumSelectableModelId(persisted.preferredPremiumModelId)
      ? persisted.preferredPremiumModelId
      : null;

  const candidatePremiumModelId: string | null =
    requested === "premium" ? bodyPremium ?? persistedPremiumOk ?? defaultPremiumId : null;

  if (identity.conversation_id) {
    if (explicitTier && parsedModelTier !== undefined) {
      const newTier = parsedModelTier;
      const premiumToStore =
        newTier === "premium"
          ? bodyPremium ?? persistedPremiumOk ?? defaultPremiumId
          : persisted?.preferredPremiumModelId ?? null;
      await saveConversationRoutingPreference(identity.workspace_id, identity.conversation_id, {
        modelTier: newTier,
        preferredPremiumModelId: premiumToStore,
      });
    } else if (!explicitTier && requested === "premium" && bodyPremium) {
      await saveConversationRoutingPreference(identity.workspace_id, identity.conversation_id, {
        modelTier: requested,
        preferredPremiumModelId: bodyPremium,
      });
    }
  }

  const r = resolveTierWithEntitlements(requested, config.entitledModelTiers);
  const denyReason = r.downgraded
    ? `tier_not_entitled:${r.tier_downgraded_from}->${r.tier_downgraded_to}`
    : undefined;

  const effectivePremiumModelId = r.effective === "premium" ? candidatePremiumModelId : null;

  return {
    effective: r.effective,
    requested,
    downgraded: r.downgraded,
    tier_downgraded_from: r.tier_downgraded_from,
    tier_downgraded_to: r.tier_downgraded_to,
    denyReason,
    effectivePremiumModelId,
  };
}
