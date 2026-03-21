import { describe, it, expect, vi, beforeEach } from "vitest";
import { runIntentPipeline } from "./run-intent-pipeline";
import type { ContextBundle } from "../modules/context-builder-adapter/context-builder.types";
import type { IntentReasoning } from "../modules/intent-reasoner/reasoning.types";

vi.mock("../modules/context-builder-adapter", () => ({
  buildContext: vi.fn(),
}));

vi.mock("../modules/intent-reasoner", () => ({
  runReasoning: vi.fn(),
}));

vi.mock("../modules/intent-classifier", () => ({
  classifyIntent: vi.fn(),
}));

import { buildContext } from "../modules/context-builder-adapter";
import { runReasoning } from "../modules/intent-reasoner";
import { classifyIntent } from "../modules/intent-classifier";

const mockedBuildContext = vi.mocked(buildContext);
const mockedRunReasoning = vi.mocked(runReasoning);
const mockedClassifyIntent = vi.mocked(classifyIntent);

beforeEach(() => {
  vi.clearAllMocks();
  mockedClassifyIntent.mockImplementation(async (prompt) => {
    const text = (prompt as { normalized?: string }).normalized ?? "";
    if (/^hi\b|^hello\b/i.test(text.trim())) {
      return { intentType: "GENERIC", confidence: 1, matchedKeywords: [] };
    }
    if (/fix|bug|error/i.test(text)) {
      return { intentType: "CODE_FIX", confidence: 1, matchedKeywords: [] };
    }
    if (/add|implement|create/i.test(text)) {
      return {
        intentType: "FEATURE_IMPLEMENTATION",
        confidence: 1,
        matchedKeywords: [],
      };
    }
    return { intentType: "CODE_FIX", confidence: 1, matchedKeywords: [] };
  });
  mockedBuildContext.mockResolvedValue({
    files: ["auth/login.ts"],
    functions: ["loginUser"],
  } as ContextBundle);
  mockedRunReasoning.mockResolvedValue({
    detectedComponents: ["loginUser", "auth/login.ts"],
    missingComponents: [],
    potentialIssues: ["Validation incomplete"],
    recommendedNextStep: "Apply patch",
  } as IntentReasoning);
});

describe("Intent Pipeline (default: pure intent)", () => {
  it("classifies fix login api as CODE_FIX", async () => {
    const result = await runIntentPipeline("fix login api");

    expect(result.intent.intentType).toBe("CODE_FIX");
  });

  it("classifies hi as GENERIC", async () => {
    const result = await runIntentPipeline("hi");

    expect(result.intent.intentType).toBe("GENERIC");
  });

  it("returns normalized prompt, intent, entities, and response; no reasoning or contextRequest by default", async () => {
    const result = await runIntentPipeline("fix login api");

    expect(result.normalizedPrompt).toBeDefined();
    expect(result.normalizedPrompt.original).toBe("fix login api");
    expect(result.entities).toBeDefined();
    expect(result.response).toBeDefined();
    expect(result.reasoning).toBeUndefined();
    expect(result.contextRequest).toBeUndefined();
    expect(result.tasks).toBeUndefined();
    expect(mockedBuildContext).not.toHaveBeenCalled();
    expect(mockedRunReasoning).not.toHaveBeenCalled();
  });

  it("legacy path with skipContextRequest: false and skipReasoning: false runs context + reasoning", async () => {
    const result = await runIntentPipeline("add password reset", {
      skipContextRequest: false,
      skipReasoning: false,
    });

    expect(mockedBuildContext).toHaveBeenCalledTimes(1);
    expect(mockedRunReasoning).toHaveBeenCalledTimes(1);
    expect(result.contextRequest).toBeDefined();
    expect(result.tasks).toBeDefined();
    expect(result.reasoning).toBeDefined();
    const [userPrompt, intent, entities, tasks, contextBundle] =
      mockedRunReasoning.mock.calls[0];
    expect(userPrompt).toBe("add password reset");
    expect(intent.intentType).toBe("FEATURE_IMPLEMENTATION");
    expect(entities.entities).toBeDefined();
    expect(tasks.tasks.length).toBeGreaterThan(0);
    expect(contextBundle).toEqual(
      expect.objectContaining({
        files: ["auth/login.ts"],
        functions: ["loginUser"],
      }),
    );
  });
});
