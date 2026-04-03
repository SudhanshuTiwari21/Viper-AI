import type { ModelSpec, ModelTier } from "@repo/model-registry";
import { getDefaultModelForTier } from "@repo/model-registry";
import type { ChatMode } from "../validators/request.schemas.js";

// ---------------------------------------------------------------------------
// E.24 — Vision-routing error (surfaced as 400 by the controller)
// ---------------------------------------------------------------------------

/**
 * Thrown by routeModelForRequest when attachments are present but the selected
 * model does not support vision and no upgrade path exists in the registry.
 */
export class VisionNotSupportedError extends Error {
  constructor(modelId: string) {
    super(
      `Selected model "${modelId}" does not support vision. ` +
        "No vision-capable model is available for this request configuration. " +
        "Remove image attachments or choose a vision-capable model tier.",
    );
    this.name = "VisionNotSupportedError";
  }
}

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
  /**
   * E.24: true when the tier was upgraded to premium specifically because the
   * original selection lacked vision capability and the premium default supports vision.
   */
  visionUpgraded?: boolean;
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
  const { tier, reason: tierReason, signals } = pickTier(inputs);
  let selected = getDefaultModelForTier(tier);
  let reason = tierReason;
  let visionUpgraded = false;

  // E.24: if attachments are present, ensure the routed model supports vision.
  // Upgrade to premium default if the fast default lacks vision; mark the decision.
  if (inputs.hasAttachments) {
    signals.vision_required = true;
    if (!selected.capabilities.vision) {
      const premiumSpec = getDefaultModelForTier("premium");
      if (premiumSpec.capabilities.vision) {
        selected = premiumSpec;
        reason = "vision_upgrade_to_premium";
        visionUpgraded = true;
        signals.vision_upgraded = true;
      } else {
        // No vision-capable model found — caller (routeModelForRequest) will throw.
        signals.vision_no_capable_model = true;
      }
    }
  }

  return { selected, reason, signals, visionUpgraded };
}

// ---------------------------------------------------------------------------
// H.44 — Candidate routing policy (shadow traffic + staged rollout)
// ---------------------------------------------------------------------------

/**
 * Label for the candidate policy shipped in H.44.
 *
 * Delta from live `selectModel`:
 *   Live Rule 1: ask / plan → fast (regardless of intent)
 *   Candidate delta: plan + complex intents → premium
 *
 * Rationale: The live policy routes `plan` mode to fast to save costs.
 * The candidate tests whether routing plan requests that carry a complex
 * coding intent (CODE_FIX, IMPLEMENT_FEATURE, REFACTOR, PROJECT_SETUP)
 * to the premium tier improves plan quality at acceptable cost increase.
 * All other rules are identical to the live policy.
 */
export const CANDIDATE_POLICY_LABEL = "v2-plan-complex-premium";

const COMPLEX_INTENTS = new Set(["CODE_FIX", "IMPLEMENT_FEATURE", "REFACTOR", "PROJECT_SETUP"]);

/**
 * Candidate pickTier: identical to live except plan+complex → premium.
 */
function pickTierCandidate(
  inputs: RouteInputs,
): { tier: ModelTier; reason: string; signals: RouteDecision["signals"] } {
  const signals: RouteDecision["signals"] = {
    chatMode: inputs.chatMode,
    intentType: inputs.intentType,
    isStreaming: inputs.isStreaming,
    hasAttachments: inputs.hasAttachments,
    retrievalConfidence: inputs.retrievalConfidence,
    workspaceSizeHint: inputs.workspaceSizeHint,
  };

  // Candidate delta: plan + complex intent → premium.
  if (inputs.chatMode === "plan" && COMPLEX_INTENTS.has(inputs.intentType)) {
    return { tier: "premium", reason: "candidate_plan_complex_premium", signals };
  }

  // ask / plan (non-complex) → fast (same as live).
  if (inputs.chatMode === "ask" || inputs.chatMode === "plan") {
    return { tier: "fast", reason: "mode_readonly_fast", signals };
  }

  // All remaining rules identical to live.
  if (inputs.chatMode === "debug") {
    return { tier: "premium", reason: "mode_debug_premium", signals };
  }
  if (inputs.chatMode === "agent" && COMPLEX_INTENTS.has(inputs.intentType)) {
    return { tier: "premium", reason: "agent_complex_intent_premium", signals };
  }
  if (!inputs.isStreaming) {
    return { tier: "fast", reason: "non_streaming_fast", signals };
  }
  if (
    inputs.chatMode === "agent" &&
    typeof inputs.retrievalConfidence === "number" &&
    inputs.retrievalConfidence < 0.25
  ) {
    return { tier: "premium", reason: "low_retrieval_confidence_premium", signals };
  }
  return { tier: "fast", reason: "default_fast", signals };
}

/**
 * Candidate routing policy for shadow evaluation and staged rollout (H.44).
 * Same interface as `selectModel`; plugs into the auto routing path.
 */
export function selectModelCandidate(inputs: RouteInputs): RouteDecision {
  const { tier, reason: tierReason, signals } = pickTierCandidate(inputs);
  let selected = getDefaultModelForTier(tier);
  let reason = tierReason;
  let visionUpgraded = false;

  if (inputs.hasAttachments) {
    signals.vision_required = true;
    if (!selected.capabilities.vision) {
      const premiumSpec = getDefaultModelForTier("premium");
      if (premiumSpec.capabilities.vision) {
        selected = premiumSpec;
        reason = "vision_upgrade_to_premium";
        visionUpgraded = true;
        signals.vision_upgraded = true;
      } else {
        signals.vision_no_capable_model = true;
      }
    }
  }

  return { selected, reason, signals, visionUpgraded };
}

// ---------------------------------------------------------------------------
// H.44 — Deterministic workspace bucketing for staged rollout
// ---------------------------------------------------------------------------

/**
 * Returns true when `key` falls in the candidate-policy bucket for `candidatePct` (0–100).
 *
 * Uses a djb2-style 32-bit hash so the same workspace+conversationId combination
 * always sees the same policy — no DB required.
 *
 * Ramp guide:
 *   - Set VIPER_ROUTER_POLICY_CANDIDATE_PCT=0 (or unset) → all traffic to live policy.
 *   - Ramp to 1, 5, 25, 100 incrementally; observe router:shadow:compare divergence rate
 *     from shadow logs before expanding.
 *   - Roll back instantly: set VIPER_ROUTER_POLICY_CANDIDATE_PCT=0 (or unset env).
 */
export function computeRouterBucket(key: string, candidatePct: number): boolean {
  if (candidatePct <= 0) return false;
  if (candidatePct >= 100) return true;
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    // djb2: h = h * 33 ^ char
    h = (Math.imul(h, 33) ^ key.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 100) < candidatePct;
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

