import type { ModelSpec, ModelTier } from "@repo/model-registry";
import { getDefaultModelForTier } from "@repo/model-registry";
import type { ChatMode } from "../validators/request.schemas.js";

export type ModelRouteMode = "auto" | "pinned";

export interface RouteInputs {
  chatMode: ChatMode;
  intentType: string;
  hasAttachments: boolean;
  isStreaming: boolean;
  retrievalConfidence?: number;
  workspaceSizeHint?: "small" | "large";
}

export interface RouteDecision {
  selected: ModelSpec;
  /** short machine-readable reason */
  reason: string;
  signals: Record<string, number | string | boolean | null | undefined>;
  /** Cross-tier failover targets for `auto` routing (D.18); empty when failover disabled. */
  fallbackChain?: ModelSpec[];
}

function pickTier(inputs: RouteInputs): { tier: ModelTier; reason: string; signals: RouteDecision["signals"] } {
  const signals: RouteDecision["signals"] = {
    chatMode: inputs.chatMode,
    intentType: inputs.intentType,
    isStreaming: inputs.isStreaming,
    hasAttachments: inputs.hasAttachments,
    retrievalConfidence: inputs.retrievalConfidence,
    workspaceSizeHint: inputs.workspaceSizeHint,
  };

  // Rule 1: ask/plan default to fast (cheaper, low risk).
  if (inputs.chatMode === "ask" || inputs.chatMode === "plan") {
    return { tier: "fast", reason: "mode_readonly_fast", signals };
  }

  // Rule 2: debug prefers premium for diagnosis reliability (unless explicitly pinned elsewhere).
  if (inputs.chatMode === "debug") {
    return { tier: "premium", reason: "mode_debug_premium", signals };
  }

  // Rule 3: agent complex intents prefer premium.
  const complexIntents = new Set(["CODE_FIX", "IMPLEMENT_FEATURE", "REFACTOR", "PROJECT_SETUP"]);
  if (inputs.chatMode === "agent" && complexIntents.has(inputs.intentType)) {
    return { tier: "premium", reason: "agent_complex_intent_premium", signals };
  }

  // Rule 4: non-streaming and lightweight can use fast.
  if (!inputs.isStreaming) {
    return { tier: "fast", reason: "non_streaming_fast", signals };
  }

  // Rule 5: low retrieval confidence on agent requests biases premium (optional signal).
  if (inputs.chatMode === "agent" && typeof inputs.retrievalConfidence === "number" && inputs.retrievalConfidence < 0.25) {
    return { tier: "premium", reason: "low_retrieval_confidence_premium", signals };
  }

  // Default.
  return { tier: "fast", reason: "default_fast", signals };
}

export function selectModel(inputs: RouteInputs): RouteDecision {
  const { tier, reason, signals } = pickTier(inputs);
  const selected = getDefaultModelForTier(tier);
  return { selected, reason, signals };
}

/**
 * Deterministic tier-flip fallback: fast ↔ premium registry defaults. De-dupes by model id.
 * Caps how many distinct fallback **models** are listed (D.18: max 2 fallbacks via env/router).
 */
export function buildFallbackChainForAuto(
  selected: ModelSpec,
  maxFallbackModels: number,
): ModelSpec[] {
  const cap = Math.max(0, Math.min(2, maxFallbackModels));
  if (cap === 0) return [];

  const otherTier: ModelTier = selected.tier === "premium" ? "fast" : "premium";
  const alt = getDefaultModelForTier(otherTier);
  if (alt.id === selected.id) return [];

  return [{ ...alt }].slice(0, cap);
}

