import { resolveModelSpec } from "./registry.js";

/** Weight per 1k tokens for unknown models (conservative for premium-class ids). */
const UNKNOWN_WEIGHT_PREMIUMISH = 18;
const UNKNOWN_WEIGHT_DEFAULT = 2;

export function resolveUsageCreditWeightPer1k(modelId: string): number {
  const spec = resolveModelSpec(modelId);
  if (spec?.usageCreditWeightPer1k != null && spec.usageCreditWeightPer1k > 0) {
    return spec.usageCreditWeightPer1k;
  }
  if (spec?.tier === "premium") return UNKNOWN_WEIGHT_PREMIUMISH;
  return UNKNOWN_WEIGHT_DEFAULT;
}

/**
 * Whole-number usage credits for one completed request.
 * `max(1, ceil(totalTokens/1000 * weight))` with a floor when tokens are unknown.
 */
export function computeUsageCostUnits(params: {
  modelId: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  /** When all token fields are missing/zero (e.g. streaming not wired). */
  assumedTotalTokensWhenUnknown?: number;
}): bigint {
  const w = resolveUsageCreditWeightPer1k(params.modelId);
  let tokenBase = 0;
  if (params.totalTokens != null && params.totalTokens > 0) {
    tokenBase = params.totalTokens;
  } else {
    const i = params.inputTokens ?? 0;
    const o = params.outputTokens ?? 0;
    tokenBase = i + o;
  }
  if (tokenBase <= 0) {
    tokenBase = Math.max(1, params.assumedTotalTokensWhenUnknown ?? 4096);
  }
  const units = Math.max(1, Math.ceil((tokenBase / 1000) * w));
  return BigInt(units);
}
