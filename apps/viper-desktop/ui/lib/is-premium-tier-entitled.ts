/**
 * Whether workspace entitlements allow the Premium model tier (matches /chat enforcement).
 * Null or empty allowed_model_tiers → all tiers allowed.
 * Legacy `fast` in DB means Auto routing only; Premium requires `premium` in the list.
 */
export function isPremiumTierEntitled(allowedModelTiers: string[] | null | undefined): boolean {
  if (allowedModelTiers == null || allowedModelTiers.length === 0) return true;
  return allowedModelTiers.some((t) => t === "premium");
}
