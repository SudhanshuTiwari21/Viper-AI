import { describe, expect, it, beforeEach } from "vitest";
import { parseWorkflowRuntimeConfig } from "../config/workflow-flags.js";
import { resolveEffectiveModelTier } from "./resolve-effective-model-tier.js";
import { __clearConversationModelPreferenceMemoryForTests } from "./conversation-model-preference-store.js";

describe("resolveEffectiveModelTier (D.20)", () => {
  beforeEach(() => {
    __clearConversationModelPreferenceMemoryForTests();
  });

  it("downgrades premium when entitled set excludes premium", async () => {
    const config = parseWorkflowRuntimeConfig({
      ...process.env,
      VIPER_ALLOWED_MODEL_TIERS: "auto,fast",
    } as NodeJS.ProcessEnv);

    const tierRes = await resolveEffectiveModelTier({
      parsedBody: {
        prompt: "x",
        workspacePath: "/w",
        mode: "agent",
        modelTier: "premium",
      },
      identity: {
        request_id: "r1",
        workspace_id: "ws",
        conversation_id: "conv1",
      },
      config,
    });

    expect(tierRes.requested).toBe("premium");
    expect(tierRes.effective).toBe("fast");
    expect(tierRes.downgraded).toBe(true);
    expect(tierRes.tier_downgraded_to).toBe("fast");
  });

  it("loads persisted tier when modelTier omitted", async () => {
    const config = parseWorkflowRuntimeConfig(process.env);

    await resolveEffectiveModelTier({
      parsedBody: {
        prompt: "x",
        workspacePath: "/w",
        mode: "agent",
        modelTier: "fast",
      },
      identity: {
        request_id: "r2",
        workspace_id: "ws2",
        conversation_id: "conv2",
      },
      config,
    });

    const second = await resolveEffectiveModelTier({
      parsedBody: {
        prompt: "y",
        workspacePath: "/w",
        mode: "agent",
      },
      identity: {
        request_id: "r3",
        workspace_id: "ws2",
        conversation_id: "conv2",
      },
      config,
    });

    expect(second.requested).toBe("fast");
    expect(second.effective).toBe("fast");
    expect(second.downgraded).toBe(false);
  });
});
