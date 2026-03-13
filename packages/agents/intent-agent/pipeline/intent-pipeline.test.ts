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

import { buildContext } from "../modules/context-builder-adapter";
import { runReasoning } from "../modules/intent-reasoner";

const mockedBuildContext = vi.mocked(buildContext);
const mockedRunReasoning = vi.mocked(runReasoning);

beforeEach(() => {
  vi.clearAllMocks();
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

describe("Intent Pipeline", () => {
  it("executes all steps and returns full pipeline result", async () => {
    const result = await runIntentPipeline("fix login api");

    expect(result.normalizedPrompt).toBeDefined();
    expect(result.normalizedPrompt.original).toBe("fix login api");
    expect(result.intent).toBeDefined();
    expect(result.entities).toBeDefined();
    expect(result.tasks).toBeDefined();
    expect(result.contextRequest).toBeDefined();
    expect(result.contextBundle).toBeDefined();
    expect(result.reasoning).toBeDefined();
    expect(result.response).toBeDefined();
  });

  it("produces a response object with intent and summary", async () => {
    const result = await runIntentPipeline("fix login api");

    expect(result.response.intent).toBe("CODE_FIX");
    expect(result.response.summary).toBeDefined();
    expect(typeof result.response.summary).toBe("string");
  });

  it("classifies intent from prompt (fix login api -> CODE_FIX)", async () => {
    const result = await runIntentPipeline("fix login api");

    expect(result.intent.intentType).toBe("CODE_FIX");
  });

  it("calls buildContext and runReasoning with pipeline data", async () => {
    await runIntentPipeline("add password reset");

    expect(mockedBuildContext).toHaveBeenCalledTimes(1);
    expect(mockedRunReasoning).toHaveBeenCalledTimes(1);
    const [intent, entities, tasks, contextBundle] =
      mockedRunReasoning.mock.calls[0];
    expect(intent.intentType).toBe("FEATURE_IMPLEMENTATION");
    expect(entities.entities).toBeDefined();
    expect(tasks.tasks.length).toBeGreaterThan(0);
    expect(contextBundle).toEqual(
      expect.objectContaining({ files: ["auth/login.ts"], functions: ["loginUser"] }),
    );
  });
});
