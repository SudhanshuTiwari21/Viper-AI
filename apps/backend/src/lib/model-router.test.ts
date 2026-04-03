import { describe, expect, it } from "vitest";
import {
  buildFallbackChainForAuto,
  selectModel,
  selectModelCandidate,
  computeRouterBucket,
  CANDIDATE_POLICY_LABEL,
  VisionNotSupportedError,
} from "./model-router.js";
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

// ---------------------------------------------------------------------------
// H.44 — candidate policy
// ---------------------------------------------------------------------------

describe("selectModelCandidate (H.44 candidate policy)", () => {
  it("CANDIDATE_POLICY_LABEL is defined", () => {
    expect(typeof CANDIDATE_POLICY_LABEL).toBe("string");
    expect(CANDIDATE_POLICY_LABEL.length).toBeGreaterThan(0);
  });

  it("plan + simple intent → fast (same as live)", () => {
    const d = selectModelCandidate({
      chatMode: "plan",
      intentType: "GENERIC",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("fast");
    expect(d.reason).toBe("mode_readonly_fast");
  });

  it("plan + CODE_FIX → premium (candidate delta)", () => {
    const d = selectModelCandidate({
      chatMode: "plan",
      intentType: "CODE_FIX",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("premium");
    expect(d.reason).toBe("candidate_plan_complex_premium");
  });

  it("plan + IMPLEMENT_FEATURE → premium (candidate delta)", () => {
    const d = selectModelCandidate({
      chatMode: "plan",
      intentType: "IMPLEMENT_FEATURE",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("premium");
  });

  it("plan + REFACTOR → premium (candidate delta)", () => {
    const d = selectModelCandidate({
      chatMode: "plan",
      intentType: "REFACTOR",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("premium");
  });

  it("plan + PROJECT_SETUP → premium (candidate delta)", () => {
    const d = selectModelCandidate({
      chatMode: "plan",
      intentType: "PROJECT_SETUP",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("premium");
  });

  it("ask + CODE_FIX → fast (candidate does not change ask mode)", () => {
    const d = selectModelCandidate({
      chatMode: "ask",
      intentType: "CODE_FIX",
      hasAttachments: false,
      isStreaming: true,
    });
    expect(d.selected.tier).toBe("fast");
    expect(d.reason).toBe("mode_readonly_fast");
  });

  it("debug → premium (identical to live)", () => {
    const live = selectModel({ chatMode: "debug", intentType: "GENERIC", hasAttachments: false, isStreaming: true });
    const cand = selectModelCandidate({ chatMode: "debug", intentType: "GENERIC", hasAttachments: false, isStreaming: true });
    expect(cand.selected.tier).toBe("premium");
    expect(cand.selected.id).toBe(live.selected.id);
  });

  it("agent + complex intent → premium (same as live)", () => {
    const live = selectModel({ chatMode: "agent", intentType: "CODE_FIX", hasAttachments: false, isStreaming: true });
    const cand = selectModelCandidate({ chatMode: "agent", intentType: "CODE_FIX", hasAttachments: false, isStreaming: true });
    expect(cand.selected.tier).toBe("premium");
    expect(cand.selected.id).toBe(live.selected.id);
  });

  it("agent + GENERIC → fast (same as live default)", () => {
    const live = selectModel({ chatMode: "agent", intentType: "GENERIC", hasAttachments: false, isStreaming: true });
    const cand = selectModelCandidate({ chatMode: "agent", intentType: "GENERIC", hasAttachments: false, isStreaming: true });
    expect(cand.selected.tier).toBe("fast");
    expect(cand.selected.id).toBe(live.selected.id);
  });
});

// ---------------------------------------------------------------------------
// H.44 — deterministic bucketing
// ---------------------------------------------------------------------------

describe("computeRouterBucket (H.44 staged rollout)", () => {
  it("pct=0 → always false", () => {
    expect(computeRouterBucket("any-key", 0)).toBe(false);
    expect(computeRouterBucket("another-key", 0)).toBe(false);
    expect(computeRouterBucket("", 0)).toBe(false);
  });

  it("pct=100 → always true", () => {
    expect(computeRouterBucket("any-key", 100)).toBe(true);
    expect(computeRouterBucket("another", 100)).toBe(true);
    expect(computeRouterBucket("", 100)).toBe(true);
  });

  it("same key + same pct → same result (deterministic)", () => {
    const key = "workspace/path:conv-123";
    const result1 = computeRouterBucket(key, 50);
    const result2 = computeRouterBucket(key, 50);
    expect(result1).toBe(result2);
  });

  it("pct=50 distributes roughly half/half over 1000 keys", () => {
    let inBucket = 0;
    for (let i = 0; i < 1000; i++) {
      if (computeRouterBucket(`workspace-${i}:conv-${i}`, 50)) inBucket++;
    }
    // Allow ±10% deviation from 50% for statistical noise.
    expect(inBucket).toBeGreaterThan(400);
    expect(inBucket).toBeLessThan(600);
  });

  it("pct=5 puts approximately 5% in bucket", () => {
    let inBucket = 0;
    for (let i = 0; i < 1000; i++) {
      if (computeRouterBucket(`ws-${i}:conv-${i}`, 5)) inBucket++;
    }
    expect(inBucket).toBeGreaterThan(20);
    expect(inBucket).toBeLessThan(100);
  });

  it("different keys produce different results (not always same bucket)", () => {
    // With 50% rollout and 100 diverse keys, we expect both true and false to appear.
    const results = new Set<boolean>();
    for (let i = 0; i < 100; i++) {
      results.add(computeRouterBucket(`workspace/project-${i}:conversation-${i * 7}`, 50));
      if (results.size === 2) break;
    }
    expect(results.size).toBe(2);
  });

  it("negative pct treated as 0 → always false", () => {
    expect(computeRouterBucket("key", -10)).toBe(false);
  });

  it("pct > 100 treated as 100 → always true", () => {
    expect(computeRouterBucket("key", 150)).toBe(true);
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

