import { describe, expect, it } from "vitest";
import {
  buildEntitledTierSet,
  parseAllowedModelTiersFromEnv,
  resolveTierWithEntitlements,
} from "./model-tier-entitlements.js";

describe("parseAllowedModelTiersFromEnv", () => {
  it("defaults to auto and premium", () => {
    const s = parseAllowedModelTiersFromEnv({});
    expect(s.has("auto")).toBe(true);
    expect(s.has("premium")).toBe(true);
    expect(s.size).toBe(2);
  });

  it("parses comma list", () => {
    const s = parseAllowedModelTiersFromEnv({
      VIPER_ALLOWED_MODEL_TIERS: "auto, fast",
    } as NodeJS.ProcessEnv);
    expect(s.has("auto")).toBe(true);
    expect(s.has("premium")).toBe(false);
  });

  it("maps legacy fast entry to auto", () => {
    const s = parseAllowedModelTiersFromEnv({
      VIPER_ALLOWED_MODEL_TIERS: "fast",
    } as NodeJS.ProcessEnv);
    expect([...s]).toEqual(["auto"]);
  });
});

describe("resolveTierWithEntitlements", () => {
  it("downgrades premium to auto when premium missing from entitled set", () => {
    const entitled = new Set<"auto" | "premium">(["auto"]);
    const r = resolveTierWithEntitlements("premium", entitled);
    expect(r.effective).toBe("auto");
    expect(r.downgraded).toBe(true);
    expect(r.tier_downgraded_from).toBe("premium");
    expect(r.tier_downgraded_to).toBe("auto");
  });

  it("no-op when requested tier is allowed", () => {
    const entitled = new Set<"auto" | "premium">(["auto", "premium"]);
    const r = resolveTierWithEntitlements("premium", entitled);
    expect(r.effective).toBe("premium");
    expect(r.downgraded).toBe(false);
  });
});

describe("buildEntitledTierSet", () => {
  it("removes premium when premiumRequiresEntitlement and not entitled", () => {
    const s = buildEntitledTierSet({
      allowedFromEnv: new Set(["auto", "premium"]),
      premiumRequiresEntitlement: true,
      premiumEntitled: false,
    });
    expect(s.has("premium")).toBe(false);
    expect(s.has("auto")).toBe(true);
  });
});
