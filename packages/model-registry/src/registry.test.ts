import { describe, expect, it } from "vitest";
import {
  getDefaultModelForTier,
  getModelRegistry,
  resolveModelSpec,
  assertValidModelId,
} from "./index.js";

describe("@repo/model-registry", () => {
  it("returns a registry with at least one model", () => {
    const reg = getModelRegistry();
    expect(Object.keys(reg).length).toBeGreaterThan(0);
  });

  it("default tier resolution returns a spec", () => {
    expect(getDefaultModelForTier("auto").id).toBeTruthy();
    expect(getDefaultModelForTier("fast").id).toBeTruthy();
    expect(getDefaultModelForTier("premium").id).toBeTruthy();
  });

  it("resolveModelSpec returns null for unknown ids", () => {
    expect(resolveModelSpec("not-a-real-model")).toBeNull();
  });

  it("assertValidModelId throws for unknown ids", () => {
    expect(() => assertValidModelId("not-a-real-model")).toThrow(/Unknown model id/);
  });

  it("every spec has sane required fields", () => {
    const reg = getModelRegistry();
    for (const spec of Object.values(reg)) {
      expect(spec.id).toBeTruthy();
      expect(spec.provider).toBeTruthy();
      expect(spec.displayName).toBeTruthy();
      expect(spec.tier).toMatch(/auto|premium|fast/);
      expect(typeof spec.capabilities.tools).toBe("boolean");
      expect(typeof spec.capabilities.vision).toBe("boolean");
      expect(typeof spec.capabilities.json).toBe("boolean");
      if (spec.limits.maxToolCalls != null) {
        expect(spec.limits.maxToolCalls).toBeGreaterThan(0);
        expect(spec.limits.maxToolCalls).toBeLessThanOrEqual(50);
      }
      if (spec.limits.timeoutMs != null) {
        expect(spec.limits.timeoutMs).toBeGreaterThan(0);
      }
    }
  });
});

