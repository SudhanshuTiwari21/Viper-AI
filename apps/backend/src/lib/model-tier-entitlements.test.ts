import { describe, expect, it } from "vitest";
import {
  buildEntitledTierSet,
  parseAllowedModelTiersFromEnv,
  resolveTierWithEntitlements,
} from "./model-tier-entitlements.js";

describe("parseAllowedModelTiersFromEnv", () => {
  it("defaults to all tiers", () => {
    const s = parseAllowedModelTiersFromEnv({});
    expect(s.has("auto")).toBe(true);
    expect(s.has("fast")).toBe(true);
    expect(s.has("premium")).toBe(true);
  });

  it("parses comma list", () => {
    const s = parseAllowedModelTiersFromEnv({
      VIPER_ALLOWED_MODEL_TIERS: "auto, fast",
    } as NodeJS.ProcessEnv);
    expect(s.has("auto")).toBe(true);
    expect(s.has("fast")).toBe(true);
    expect(s.has("premium")).toBe(false);
  });
});

describe("resolveTierWithEntitlements", () => {
  it("downgrades premium to fast when premium missing from entitled set", () => {
    const entitled = new Set<"auto" | "fast" | "premium">(["auto", "fast"]);
    const r = resolveTierWithEntitlements("premium", entitled);
    expect(r.effective).toBe("fast");
    expect(r.downgraded).toBe(true);
    expect(r.tier_downgraded_from).toBe("premium");
    expect(r.tier_downgraded_to).toBe("fast");
  });

  it("downgrades premium to auto when only auto allowed", () => {
    const entitled = new Set<"auto" | "fast" | "premium">(["auto"]);
    const r = resolveTierWithEntitlements("premium", entitled);
    expect(r.effective).toBe("auto");
    expect(r.downgraded).toBe(true);
  });

  it("no-op when requested tier is allowed", () => {
    const entitled = new Set<"auto" | "fast" | "premium">(["auto", "fast", "premium"]);
    const r = resolveTierWithEntitlements("fast", entitled);
    expect(r.effective).toBe("fast");
    expect(r.downgraded).toBe(false);
  });
});

describe("buildEntitledTierSet", () => {
  it("removes premium when premiumRequiresEntitlement and not entitled", () => {
    const s = buildEntitledTierSet({
      allowedFromEnv: new Set(["auto", "fast", "premium"]),
      premiumRequiresEntitlement: true,
      premiumEntitled: false,
    });
    expect(s.has("premium")).toBe(false);
    expect(s.has("fast")).toBe(true);
  });
});
