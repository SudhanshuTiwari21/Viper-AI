export type ModelProvider = "openai";

export type ModelTier = "auto" | "premium" | "fast";

export type PriceClass = "low" | "medium" | "high";

export type LatencyClass = "fast" | "medium" | "slow";

export type ModelId = string & { readonly __brand: "ModelId" };

export interface ModelSpec {
  id: ModelId;
  provider: ModelProvider;
  displayName: string;
  /** Primary tier this model belongs to (router may override later). */
  tier: ModelTier;
  capabilities: {
    tools: boolean;
    vision: boolean;
    json: boolean;
  };
  limits: {
    /** Approx model context window, used for guardrails only. */
    maxInputTokens?: number;
    /** Hard cap for response generation (policy knob). */
    maxOutputTokens?: number;
    /** Hard cap on tool-call rounds (policy knob). */
    maxToolCalls?: number;
    /** Request time budget (policy knob). */
    timeoutMs?: number;
  };
  priceClass?: PriceClass;
  latencyClass?: LatencyClass;
  /** When true, allowed for Premium tier picker (API `premiumModelId` + desktop UI). */
  selectableInPremiumUi?: boolean;
}

