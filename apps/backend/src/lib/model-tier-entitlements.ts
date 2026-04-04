import type { ModelTierSelection } from "../validators/request.schemas.js";

const ALL_TIERS: ModelTierSelection[] = ["auto", "fast", "premium"];
const DOWNGRADE_ORDER: ModelTierSelection[] = ["premium", "fast", "auto"];

/** Parse `VIPER_ALLOWED_MODEL_TIERS` — comma-separated subset of auto|fast|premium. */
export function parseAllowedModelTiersFromEnv(env: NodeJS.ProcessEnv): Set<ModelTierSelection> {
  const raw = env.VIPER_ALLOWED_MODEL_TIERS?.trim() ?? "auto,fast,premium";
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const set = new Set<ModelTierSelection>();
  for (const p of parts) {
    if (p === "auto" || p === "premium" || p === "fast") {
      set.add(p);
    }
  }
  if (set.size === 0) {
    for (const t of ALL_TIERS) set.add(t);
  }
  return set;
}

export function parsePremiumRequiresEntitlement(env: NodeJS.ProcessEnv): boolean {
  return (env.VIPER_PREMIUM_REQUIRES_ENTITLEMENT ?? "false").toLowerCase() === "true";
}

/** When `VIPER_PREMIUM_REQUIRES_ENTITLEMENT` is on, premium is allowed only if this is true. Default true. */
export function parsePremiumEntitled(env: NodeJS.ProcessEnv): boolean {
  const raw = env.VIPER_PREMIUM_ENTITLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return true;
}

/**
 * Builds the effective entitlement set: allowed tiers minus premium when the premium gate is on and not entitled.
 */
export function buildEntitledTierSet(params: {
  allowedFromEnv: ReadonlySet<ModelTierSelection>;
  premiumRequiresEntitlement: boolean;
  premiumEntitled: boolean;
}): Set<ModelTierSelection> {
  const s = new Set(params.allowedFromEnv);
  if (params.premiumRequiresEntitlement && !params.premiumEntitled) {
    s.delete("premium");
  }
  if (s.size === 0) {
    s.add("auto");
  }
  return s;
}

/**
 * If `requested` is in `entitled`, return it. Otherwise pick the highest tier in downgrade order that is still in `entitled`.
 */
export function resolveTierWithEntitlements(
  requested: ModelTierSelection,
  entitled: ReadonlySet<ModelTierSelection>,
): { effective: ModelTierSelection; downgraded: boolean; tier_downgraded_from?: ModelTierSelection; tier_downgraded_to?: ModelTierSelection } {
  if (entitled.has(requested)) {
    return { effective: requested, downgraded: false };
  }
  const start = DOWNGRADE_ORDER.indexOf(requested);
  const from = start >= 0 ? start : 0;
  for (let i = from; i < DOWNGRADE_ORDER.length; i++) {
    const t = DOWNGRADE_ORDER[i]!;
    if (entitled.has(t)) {
      return {
        effective: t,
        downgraded: true,
        tier_downgraded_from: requested,
        tier_downgraded_to: t,
      };
    }
  }
  for (const t of ["auto", "fast", "premium"] as const) {
    if (entitled.has(t)) {
      return {
        effective: t,
        downgraded: true,
        tier_downgraded_from: requested,
        tier_downgraded_to: t,
      };
    }
  }
  return {
    effective: "auto",
    downgraded: requested !== "auto",
    tier_downgraded_from: requested,
    tier_downgraded_to: "auto",
  };
}
