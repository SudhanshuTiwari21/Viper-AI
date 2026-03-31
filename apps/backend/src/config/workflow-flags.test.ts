import { describe, it, expect } from "vitest";
import {
  parseWorkflowRuntimeConfig,
  parseMinRetrievalConfidenceForEdits,
  parsePostEditAutoRepairMaxExtraValidationRuns,
} from "./workflow-flags.js";

function env(partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...partial } as NodeJS.ProcessEnv;
}

describe("parseWorkflowRuntimeConfig", () => {
  it("defaults match empty env for flags and models", () => {
    const c = parseWorkflowRuntimeConfig(env({}));
    expect(c.debugAssistant).toBe(false);
    expect(c.debugWorkflow).toBe(false);
    expect(c.enableStreamContextPrimer).toBe(true);
    expect(c.streamAnalysisWarmupMs).toBe(2500);
    expect(c.requireAnalysisForEdits).toBe(false);
    expect(c.minFilesReadBeforeEdit).toBe(2);
    expect(c.minDiscoveryToolsBeforeEdit).toBe(1);
    expect(c.openaiModel).toBe("gpt-4o-mini");
    expect(c.resolvedModelId).toBe("gpt-4o-mini");
    expect(c.resolvedModelProvider).toBe("openai");
    expect(c.resolvedModelTier).toBeTruthy();
    expect(c.disableLlmCache).toBe(false);
    expect(c.directLlmCacheTtl).toBe(900);
    expect(c.chatHistoryLimit).toBe(10);
    expect(c.runAnalysisWaitMs).toBe(12000);
    expect(c.modeDefault).toBeUndefined();
    expect(c.modelRouteDefault).toBeUndefined();
    expect(c.minRetrievalConfidenceForEdits).toBe(0);
    expect(c.enablePostEditValidation).toBe(false);
    expect(c.postEditValidationCommand).toBe("npm run check-types");
    expect(c.postEditValidationTimeoutMs).toBe(30000);
    expect(c.enablePostEditAutoRepair).toBe(false);
    expect(c.postEditAutoRepairCommand).toBe("");
    expect(c.postEditAutoRepairMaxExtraValidationRuns).toBe(1);
    expect(c.postEditAutoRepairTimeoutMs).toBe(30000);
  });

  it("OPENAI_MODEL: known ids resolve; unknown falls back predictably", () => {
    const known = parseWorkflowRuntimeConfig(env({ OPENAI_MODEL: "gpt-4o" }));
    expect(known.openaiModel).toBe("gpt-4o");
    expect(known.resolvedModelId).toBe("gpt-4o");

    const unknown = parseWorkflowRuntimeConfig(env({ OPENAI_MODEL: "definitely-not-real" }));
    expect(unknown.openaiModel).toBe("definitely-not-real");
    // fallback = registry fast default
    expect(unknown.resolvedModelId).toBe("gpt-4o-mini");
  });

  it("VIPER_DEBUG_ASSISTANT and VIPER_DEBUG_WORKFLOW only when === \"1\"", () => {
    expect(parseWorkflowRuntimeConfig(env({ VIPER_DEBUG_ASSISTANT: "1" })).debugAssistant).toBe(
      true,
    );
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_DEBUG_ASSISTANT: "true" })).debugAssistant,
    ).toBe(false);
    expect(parseWorkflowRuntimeConfig(env({ VIPER_DEBUG_WORKFLOW: "1" })).debugWorkflow).toBe(
      true,
    );
  });

  it("VIPER_ENABLE_STREAM_CONTEXT_PRIMER: only explicit false disables", () => {
    expect(parseWorkflowRuntimeConfig(env({})).enableStreamContextPrimer).toBe(true);
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_ENABLE_STREAM_CONTEXT_PRIMER: "false" }))
        .enableStreamContextPrimer,
    ).toBe(false);
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_ENABLE_STREAM_CONTEXT_PRIMER: "FALSE" }))
        .enableStreamContextPrimer,
    ).toBe(false);
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_ENABLE_STREAM_CONTEXT_PRIMER: "true" }))
        .enableStreamContextPrimer,
    ).toBe(true);
  });

  it("VIPER_REQUIRE_ANALYSIS_FOR_EDITS toggle", () => {
    expect(parseWorkflowRuntimeConfig(env({})).requireAnalysisForEdits).toBe(false);
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_REQUIRE_ANALYSIS_FOR_EDITS: "true" }))
        .requireAnalysisForEdits,
    ).toBe(true);
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_REQUIRE_ANALYSIS_FOR_EDITS: "TRUE" }))
        .requireAnalysisForEdits,
    ).toBe(true);
  });

  it("numeric envs clamp with Math.max(0, …) like assistant.service", () => {
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_STREAM_ANALYSIS_WARMUP_MS: "-100" }))
        .streamAnalysisWarmupMs,
    ).toBe(0);
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_MIN_FILES_READ_BEFORE_EDIT: "-1" }))
        .minFilesReadBeforeEdit,
    ).toBe(0);
    expect(
      parseWorkflowRuntimeConfig(env({ RUN_ANALYSIS_WAIT_MS: "-5" })).runAnalysisWaitMs,
    ).toBe(0);
  });

  it("CHAT_HISTORY_LIMIT clamps to 0..10", () => {
    expect(parseWorkflowRuntimeConfig(env({ CHAT_HISTORY_LIMIT: "15" })).chatHistoryLimit).toBe(
      10,
    );
    expect(parseWorkflowRuntimeConfig(env({ CHAT_HISTORY_LIMIT: "0" })).chatHistoryLimit).toBe(0);
  });

  it("DISABLE_LLM_CACHE forces directLlmCacheTtl to 0", () => {
    const c = parseWorkflowRuntimeConfig(
      env({ DISABLE_LLM_CACHE: "true", DIRECT_LLM_CACHE_TTL: "500" }),
    );
    expect(c.disableLlmCache).toBe(true);
    expect(c.directLlmCacheTtl).toBe(0);
  });

  it("invalid int: preserves NaN through Math.max like prior code (non-throwing)", () => {
    const c = parseWorkflowRuntimeConfig(env({ VIPER_STREAM_ANALYSIS_WARMUP_MS: "not-a-number" }));
    expect(Number.isNaN(c.streamAnalysisWarmupMs)).toBe(true);
  });

  it("VIPER_ENABLE_POST_EDIT_VALIDATION and post-edit command defaults", () => {
    expect(parseWorkflowRuntimeConfig(env({})).enablePostEditValidation).toBe(false);
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_ENABLE_POST_EDIT_VALIDATION: "true" }))
        .enablePostEditValidation,
    ).toBe(true);
    expect(parseWorkflowRuntimeConfig(env({})).postEditValidationCommand).toBe("npm run check-types");
    expect(
      parseWorkflowRuntimeConfig(
        env({ VIPER_POST_EDIT_VALIDATION_COMMAND: "  pnpm run lint  " }),
      ).postEditValidationCommand,
    ).toBe("pnpm run lint");
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_POST_EDIT_VALIDATION_TIMEOUT_MS: "5000" }))
        .postEditValidationTimeoutMs,
    ).toBe(5000);
  });

  it("B.9 auto-repair flags and max-extra clamp 1–3", () => {
    expect(
      parseWorkflowRuntimeConfig(env({ VIPER_ENABLE_POST_EDIT_AUTO_REPAIR: "true" }))
        .enablePostEditAutoRepair,
    ).toBe(true);
    expect(
      parseWorkflowRuntimeConfig(
        env({ VIPER_POST_EDIT_AUTO_REPAIR_COMMAND: "  npm run lint --fix  " }),
      ).postEditAutoRepairCommand,
    ).toBe("npm run lint --fix");
    expect(parsePostEditAutoRepairMaxExtraValidationRuns(env({}))).toBe(1);
    expect(parsePostEditAutoRepairMaxExtraValidationRuns(env({ VIPER_POST_EDIT_AUTO_REPAIR_MAX_EXTRA_VALIDATION_RUNS: "3" }))).toBe(3);
    expect(parsePostEditAutoRepairMaxExtraValidationRuns(env({ VIPER_POST_EDIT_AUTO_REPAIR_MAX_EXTRA_VALIDATION_RUNS: "99" }))).toBe(3);
    expect(parsePostEditAutoRepairMaxExtraValidationRuns(env({ VIPER_POST_EDIT_AUTO_REPAIR_MAX_EXTRA_VALIDATION_RUNS: "0" }))).toBe(1);
    expect(parsePostEditAutoRepairMaxExtraValidationRuns(env({ VIPER_POST_EDIT_AUTO_REPAIR_MAX_EXTRA_VALIDATION_RUNS: "bogus" }))).toBe(1);
    const c = parseWorkflowRuntimeConfig(
      env({
        VIPER_POST_EDIT_VALIDATION_TIMEOUT_MS: "7000",
      }),
    );
    expect(c.postEditAutoRepairTimeoutMs).toBe(7000);
    expect(
      parseWorkflowRuntimeConfig(
        env({
          VIPER_POST_EDIT_VALIDATION_TIMEOUT_MS: "7000",
          VIPER_POST_EDIT_AUTO_REPAIR_TIMEOUT_MS: "5000",
        }),
      ).postEditAutoRepairTimeoutMs,
    ).toBe(5000);
  });

  it("VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS: default 0, clamp [0,1], invalid → 0", () => {
    expect(parseMinRetrievalConfidenceForEdits(env({}))).toBe(0);
    expect(
      parseMinRetrievalConfidenceForEdits(env({ VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS: "0.55" })),
    ).toBe(0.55);
    expect(
      parseMinRetrievalConfidenceForEdits(env({ VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS: "2" })),
    ).toBe(1);
    expect(
      parseMinRetrievalConfidenceForEdits(env({ VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS: "-0.5" })),
    ).toBe(0);
    expect(
      parseMinRetrievalConfidenceForEdits(env({ VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS: "bogus" })),
    ).toBe(0);
  });
});
