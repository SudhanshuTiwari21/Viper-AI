import { describe, expect, it } from "vitest";
import { buildFallbackChainForAuto, selectModel, VisionNotSupportedError } from "./model-router.js";
import { getDefaultModelForTier } from "@repo/model-registry";

describe("model-router (D.17)", () => {
  it("ask routes to fast", () => {
    const d = selectModel({
      chatMode: "ask",
      intentType: "CODE_FIX",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("fast");
    expect(d.reason).toBe("mode_readonly_fast");
  });

  it("plan routes to fast", () => {
    const d = selectModel({
      chatMode: "plan",
      intentType: "IMPLEMENT_FEATURE",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("fast");
  });

  it("debug routes to premium", () => {
    const d = selectModel({
      chatMode: "debug",
      intentType: "CODE_GUIDANCE",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("premium");
    expect(d.reason).toBe("mode_debug_premium");
  });

  it("agent complex intents route to premium", () => {
    const d = selectModel({
      chatMode: "agent",
      intentType: "CODE_FIX",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("premium");
  });

  it("agent default routes to fast", () => {
    const d = selectModel({
      chatMode: "agent",
      intentType: "CODE_GUIDANCE",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("fast");
  });
});

describe("model-router vision routing (E.24)", () => {
  it("hasAttachments: true → vision_required in signals", () => {
    const d = selectModel({
      chatMode: "ask",
      intentType: "GENERIC",
      hasAttachments: true,
      isStreaming: true,
    });
    expect(d.signals.vision_required).toBe(true);
  });

  it("hasAttachments: false → vision_required not set in signals", () => {
    const d = selectModel({
      chatMode: "ask",
      intentType: "GENERIC",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.signals.vision_required).toBeUndefined();
  });

  it("hasAttachments: true + vision-capable model → no upgrade; selected model has vision", () => {
    // Both registry defaults (gpt-4o-mini / gpt-4o) have vision, so no upgrade is needed.
    const d = selectModel({
      chatMode: "ask",
      intentType: "GENERIC",
      hasAttachments: true,
      isStreaming: true,
    });
    expect(d.selected.capabilities.vision).toBe(true);
    expect(d.visionUpgraded).toBeFalsy();
  });

  it("VisionNotSupportedError is exported and is an Error subclass", () => {
    const err = new VisionNotSupportedError("some-model");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("VisionNotSupportedError");
    expect(err.message).toContain("some-model");
  });
});

describe("model-router fallback chain (D.18)", () => {
  it("fast primary gets premium fallback; de-dupes / caps", () => {
    const fast = getDefaultModelForTier("fast");
    const chain = buildFallbackChainForAuto(fast, 2);
    expect(chain).toHaveLength(1);
    expect(chain[0]!.tier).toBe("premium");
    expect(chain[0]!.id).not.toBe(fast.id);
    expect(buildFallbackChainForAuto(fast, 0)).toEqual([]);
  });

  it("premium primary gets fast fallback", () => {
    const premium = getDefaultModelForTier("premium");
    const chain = buildFallbackChainForAuto(premium, 2);
    expect(chain).toHaveLength(1);
    expect(chain[0]!.tier).toBe("fast");
  });
});

