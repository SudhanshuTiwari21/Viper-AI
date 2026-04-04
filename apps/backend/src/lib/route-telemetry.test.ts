import { describe, it, expect } from "vitest";
import { buildRouteTelemetry, type RouteMeta } from "../types/route-telemetry.js";
import { validateWorkflowLog } from "../types/workflow-log-schema.js";

const identity = {
  request_id: "req-1",
  workspace_id: "ws-1",
  conversation_id: "conv-1" as string | null,
};

const routeMeta: RouteMeta = {
  primary_model_id: "gpt-4o-mini",
  final_model_id: "gpt-4o",
  fallback_chain: ["gpt-4o"],
  fallback_count: 1,
  intent: "CODE_FIX",
  route_mode: "auto",
  route_reason: "agent_complex_intent_premium",
};

describe("buildRouteTelemetry", () => {
  it("builds full telemetry from parts", () => {
    const t = buildRouteTelemetry({
      identity,
      mode: "agent",
      effectiveModelTier: "premium",
      tierDowngraded: false,
      routeMeta,
      latencyMs: 1234,
    });
    expect(t.request_id).toBe("req-1");
    expect(t.workspace_id).toBe("ws-1");
    expect(t.conversation_id).toBe("conv-1");
    expect(t.mode).toBe("agent");
    expect(t.effective_model_tier).toBe("premium");
    expect(t.primary_model_id).toBe("gpt-4o-mini");
    expect(t.final_model_id).toBe("gpt-4o");
    expect(t.fallback_chain).toEqual(["gpt-4o"]);
    expect(t.fallback_count).toBe(1);
    expect(t.intent).toBe("CODE_FIX");
    expect(t.route_mode).toBe("auto");
    expect(t.tier_downgraded).toBe(false);
    expect(t.latency_ms).toBe(1234);
  });

  it("handles null conversation_id", () => {
    const t = buildRouteTelemetry({
      identity: { ...identity, conversation_id: null },
      mode: "ask",
      effectiveModelTier: "auto",
      tierDowngraded: true,
      routeMeta,
      latencyMs: 500,
    });
    expect(t.conversation_id).toBeNull();
    expect(t.tier_downgraded).toBe(true);
  });
});

describe("model:route:outcome schema validation", () => {
  it("validates with latency_ms", () => {
    const res = validateWorkflowLog("model:route:outcome", {
      ...identity,
      latency_ms: 1000,
      mode: "agent",
    });
    expect(res).toEqual({ valid: true });
  });

  it("validates without latency_ms (optional for this stage)", () => {
    const res = validateWorkflowLog("model:route:outcome", identity);
    expect(res).toEqual({ valid: true });
  });
});

describe("feedback:received schema validation", () => {
  it("validates basic feedback event", () => {
    const res = validateWorkflowLog("feedback:received", {
      ...identity,
      rating: "up",
      message_id: "msg-1",
    });
    expect(res).toEqual({ valid: true });
  });
});
