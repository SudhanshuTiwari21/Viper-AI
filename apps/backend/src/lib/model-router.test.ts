import { describe, expect, it } from "vitest";
import { selectModel } from "./model-router.js";

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

