import type { ModelId, ModelSpec, ModelTier } from "./types.js";

function asModelId(id: string): ModelId {
  return id as ModelId;
}

/**
 * Central model registry. This is intentionally small/coarse:
 * - Enough metadata for tier selection, UX labeling, and limits.
 * - Exact pricing/context window can be refined later (D.17+).
 */
const REGISTRY: Record<ModelId, ModelSpec> = {
  [asModelId("gpt-4o-mini")]: {
    id: asModelId("gpt-4o-mini"),
    provider: "openai",
    displayName: "GPT-4o mini",
    tier: "fast",
    capabilities: { tools: true, vision: true, json: true },
    limits: { maxOutputTokens: 2048, maxToolCalls: 15, timeoutMs: 300_000 },
    priceClass: "low",
    latencyClass: "fast",
    usageCreditWeightPer1k: 1,
  },
  [asModelId("gpt-4o")]: {
    id: asModelId("gpt-4o"),
    provider: "openai",
    displayName: "GPT-4o",
    tier: "premium",
    capabilities: { tools: true, vision: true, json: true },
    limits: { maxOutputTokens: 4096, maxToolCalls: 15, timeoutMs: 300_000 },
    priceClass: "high",
    latencyClass: "medium",
    selectableInPremiumUi: true,
    usageCreditWeightPer1k: 14,
  },
  [asModelId("gpt-4-turbo")]: {
    id: asModelId("gpt-4-turbo"),
    provider: "openai",
    displayName: "GPT-4 Turbo",
    tier: "premium",
    capabilities: { tools: true, vision: true, json: true },
    limits: { maxOutputTokens: 4096, maxToolCalls: 15, timeoutMs: 300_000 },
    priceClass: "high",
    latencyClass: "medium",
    selectableInPremiumUi: true,
    usageCreditWeightPer1k: 10,
  },
} as const;

const DEFAULTS: Record<ModelTier, ModelId> = {
  auto: asModelId("gpt-4o-mini"),
  premium: asModelId("gpt-4o"),
  fast: asModelId("gpt-4o-mini"),
};

export function getModelRegistry(): Record<ModelId, ModelSpec> {
  return { ...REGISTRY };
}

export function resolveModelSpec(modelId: string): ModelSpec | null {
  const key = modelId as ModelId;
  return REGISTRY[key] ?? null;
}

export function assertValidModelId(modelId: string): ModelId {
  const spec = resolveModelSpec(modelId);
  if (!spec) {
    throw new Error(`Unknown model id: ${modelId}`);
  }
  return spec.id;
}

export function getDefaultModelForTier(tier: ModelTier): ModelSpec {
  const id = DEFAULTS[tier];
  const spec = REGISTRY[id];
  if (!spec) {
    throw new Error(`Default model missing for tier: ${tier}`);
  }
  return spec;
}

/** Models the user may select when `modelTier === "premium"` (OpenAI today; more providers later). */
export function listPremiumSelectableModels(): ModelSpec[] {
  return Object.values(REGISTRY).filter((s) => s.selectableInPremiumUi === true);
}

export function isPremiumSelectableModelId(id: string): boolean {
  const spec = resolveModelSpec(id);
  return spec?.selectableInPremiumUi === true;
}

