import { beforeEach, describe, expect, it, vi } from "vitest";

type OpenAIChunk = {
  choices: Array<{ delta: { content?: string; tool_calls?: unknown[] } }>;
};

function streamFromChunks(chunks: OpenAIChunk[]) {
  return (async function* () {
    for (const c of chunks) yield c;
  })();
}

function makeOpenAIRecorder(options?: {
  failFirstStreamWith429?: boolean;
}) {
  const seenModels: string[] = [];
  let streamCalls = 0;
  const client = {
    chat: {
      completions: {
        create: vi.fn(async (args: { model: string; stream?: boolean }) => {
          seenModels.push(args.model);
          if (options?.failFirstStreamWith429 && args.stream && streamCalls++ === 0) {
            throw Object.assign(new Error("rate limit"), { status: 429 });
          }
          return streamFromChunks([{ choices: [{ delta: { content: "ok" } }] }]);
        }),
      },
    },
  };
  return { client, seenModels };
}

// Shared mocks (no external deps)
vi.mock("@repo/database", () => ({
  getPool: vi.fn(() => ({})),
  insertMemoryEntry: vi.fn(async () => {}),
  getMemoryEntriesBySession: vi.fn(async () => []),
  searchMemoryByKeywords: vi.fn(async () => []),
}));
vi.mock("@repo/memory-agent", () => ({
  registerDbAdapter: vi.fn(() => {}),
  buildMemorySnapshot: vi.fn(async () => ({ recentFiles: [], narrative: "" })),
  recordIntent: vi.fn(() => {}),
  recordToolResult: vi.fn(() => {}),
  recordTurnSummary: vi.fn(() => {}),
  buildRichMemoryContext: vi.fn(async () => ""),
  injectMemoryIntoPrompt: vi.fn((p: string) => p),
}));

const intentMock = vi.hoisted(() => ({ runIntentPipeline: vi.fn() }));
vi.mock("../lib/intent-agent-loader.js", () => ({
  runIntentPipeline: intentMock.runIntentPipeline,
  getIntentAgentAdapter: vi.fn(async () => ({})),
  runIntentReasoning: vi.fn(async () => ({ content: "" })),
}));
vi.mock("../services/analysis-options.service.js", () => ({
  runCodebaseAnalysisIfConfigured: vi.fn(async () => false),
}));

// Mock OpenAI constructor to return current test client.
const openAIHolder = vi.hoisted(() => ({ current: null as null | unknown }));
vi.mock("openai", () => ({
  default: class OpenAI {
    constructor() {
      if (!openAIHolder.current) throw new Error("Test OpenAI client not set");
      return openAIHolder.current as any;
    }
  },
}));

function resetBaseEnv() {
  vi.resetModules();
  process.env.OPENAI_API_KEY = "test";
  process.env.VIPER_ENABLE_STREAM_CONTEXT_PRIMER = "false";
  process.env.VIPER_STREAM_ANALYSIS_WARMUP_MS = "0";
  process.env.VIPER_DEBUG_ASSISTANT = "0";
  process.env.VIPER_DEBUG_WORKFLOW = "1";
  delete process.env.VIPER_ROUTER_SHADOW_ENABLED;
  delete process.env.VIPER_ROUTER_POLICY_CANDIDATE_PCT;
}

async function runGenericStream(
  modeEnv: string | undefined,
  chatMode: "ask" | "plan" | "debug" | "agent",
  modelTier: "auto" | "premium" | "fast" = "auto",
) {
  // Force fresh module graph with new env snapshot.
  resetBaseEnv();
  if (modeEnv === undefined) delete process.env.VIPER_MODEL_ROUTE_DEFAULT;
  else process.env.VIPER_MODEL_ROUTE_DEFAULT = modeEnv;

  intentMock.runIntentPipeline.mockResolvedValue({
    intent: { intentType: "GENERIC" },
    entities: { entities: [] },
    response: { intent: "GENERIC", summary: "GENERIC" },
  });

  const { client, seenModels } = makeOpenAIRecorder();
  openAIHolder.current = client;

  const mod = await import("../services/assistant.service.js");
  const events: Array<{ type: string; data: any }> = [];
  await mod.runAssistantStreamPipeline(
    "hello",
    "/tmp",
    (e) => events.push(e),
    { request_id: "req-1", workspace_id: "ws-1", conversation_id: "conv-1" },
    "conv-1",
    [],
    undefined,
    chatMode,
    modelTier,
  );
  return { seenModels, events };
}

// ---------------------------------------------------------------------------
// H.44 integration: shadow mode + staged rollout
// ---------------------------------------------------------------------------

describe("H.44 shadow mode + staged rollout integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openAIHolder.current = null;
  });

  it("shadow enabled: live model unchanged (observe-only)", async () => {
    // When shadow is on but rollout PCT=0, the live model (auto route: ask → fast = gpt-4o-mini)
    // must not change even though the candidate is computed for comparison.
    resetBaseEnv();
    process.env.VIPER_MODEL_ROUTE_DEFAULT = "auto";
    process.env.VIPER_ROUTER_SHADOW_ENABLED = "1";
    process.env.VIPER_ROUTER_POLICY_CANDIDATE_PCT = "0";

    intentMock.runIntentPipeline.mockResolvedValue({
      intent: { intentType: "GENERIC" },
      entities: { entities: [] },
      response: { intent: "GENERIC", summary: "GENERIC" },
    });

    const { client, seenModels } = makeOpenAIRecorder();
    openAIHolder.current = client;

    const mod = await import("../services/assistant.service.js");
    await mod.runAssistantStreamPipeline(
      "hello",
      "/tmp",
      () => {},
      { request_id: "req-shadow-1", workspace_id: "ws-1", conversation_id: "conv-1" },
      "conv-1",
      [],
      undefined,
      "ask",
      "auto",
    );
    // ask → fast → gpt-4o-mini — live path unchanged
    expect(seenModels[0]).toBe("gpt-4o-mini");
  });

  it("rollout PCT=100: auto route uses candidate policy (plan+CODE_FIX → premium)", async () => {
    // With PCT=100 every workspace is in the bucket. plan+CODE_FIX via candidate → premium (gpt-4o).
    resetBaseEnv();
    process.env.VIPER_MODEL_ROUTE_DEFAULT = "auto";
    process.env.VIPER_ROUTER_POLICY_CANDIDATE_PCT = "100";
    process.env.VIPER_ROUTER_SHADOW_ENABLED = "0";

    intentMock.runIntentPipeline.mockResolvedValue({
      intent: { intentType: "CODE_FIX" },
      entities: { entities: [] },
      response: { intent: "CODE_FIX", summary: "fix the bug" },
    });

    const { client, seenModels } = makeOpenAIRecorder();
    openAIHolder.current = client;

    const mod = await import("../services/assistant.service.js");
    await mod.runAssistantStreamPipeline(
      "fix the bug",
      "/tmp",
      () => {},
      { request_id: "req-rollout-1", workspace_id: "ws-1", conversation_id: "conv-1" },
      "conv-1",
      [],
      undefined,
      "plan",
      "auto",
    );
    // Candidate: plan + CODE_FIX → premium → gpt-4o
    expect(seenModels[0]).toBe("gpt-4o");
  });

  it("rollout PCT=0: auto route uses live policy (plan+CODE_FIX → fast)", async () => {
    // With PCT=0 rollout is off. Live: plan → fast → gpt-4o-mini.
    resetBaseEnv();
    process.env.VIPER_MODEL_ROUTE_DEFAULT = "auto";
    process.env.VIPER_ROUTER_POLICY_CANDIDATE_PCT = "0";

    intentMock.runIntentPipeline.mockResolvedValue({
      intent: { intentType: "CODE_FIX" },
      entities: { entities: [] },
      response: { intent: "CODE_FIX", summary: "fix the bug" },
    });

    const { client, seenModels } = makeOpenAIRecorder();
    openAIHolder.current = client;

    const mod = await import("../services/assistant.service.js");
    await mod.runAssistantStreamPipeline(
      "fix the bug",
      "/tmp",
      () => {},
      { request_id: "req-rollout-off-1", workspace_id: "ws-1", conversation_id: "conv-1" },
      "conv-1",
      [],
      undefined,
      "plan",
      "auto",
    );
    // Live: plan → fast → gpt-4o-mini
    expect(seenModels[0]).toBe("gpt-4o-mini");
  });

  it("default env: behavior identical to pre-H.44 (no shadow, no rollout)", async () => {
    // No new env vars set — must behave identically to before H.44.
    resetBaseEnv();
    const { seenModels } = await runGenericStream("auto", "debug");
    expect(seenModels[0]).toBe("gpt-4o");
  });
});

describe("D.17 integration: auto model router uses registry defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openAIHolder.current = null;
  });

  it("default pinned preserves OPENAI_MODEL behavior (fast default)", async () => {
    const { seenModels } = await runGenericStream(undefined, "debug");
    // pinned default uses resolved model id from D.16 (default gpt-4o-mini)
    expect(seenModels[0]).toBe("gpt-4o-mini");
  });

  it("auto routes debug to premium default", async () => {
    const { seenModels } = await runGenericStream("auto", "debug");
    expect(seenModels[0]).toBe("gpt-4o");
  });

  it("D.19: modelTier=premium overrides pinned primary to registry premium default", async () => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = "test";
    process.env.VIPER_ENABLE_STREAM_CONTEXT_PRIMER = "false";
    process.env.VIPER_STREAM_ANALYSIS_WARMUP_MS = "0";
    process.env.VIPER_DEBUG_ASSISTANT = "0";
    process.env.VIPER_DEBUG_WORKFLOW = "0";
    process.env.VIPER_MODEL_ROUTE_DEFAULT = "pinned";

    intentMock.runIntentPipeline.mockResolvedValue({
      intent: { intentType: "GENERIC" },
      entities: { entities: [] },
      response: { intent: "GENERIC", summary: "GENERIC" },
    });

    const { seenModels } = await runGenericStream("pinned", "agent", "premium");
    expect(seenModels[0]).toBe("gpt-4o");
  });

  it("D.19: modelTier=fast overrides auto debug (premium) routing", async () => {
    const { seenModels } = await runGenericStream("auto", "debug", "fast");
    expect(seenModels[0]).toBe("gpt-4o-mini");
  });

  it("D.18: generic streaming failovers to cross-tier model on 429", async () => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = "test";
    process.env.VIPER_ENABLE_STREAM_CONTEXT_PRIMER = "false";
    process.env.VIPER_STREAM_ANALYSIS_WARMUP_MS = "0";
    process.env.VIPER_DEBUG_ASSISTANT = "0";
    process.env.VIPER_DEBUG_WORKFLOW = "0";
    process.env.VIPER_MODEL_ROUTE_DEFAULT = "auto";

    intentMock.runIntentPipeline.mockResolvedValue({
      intent: { intentType: "GENERIC" },
      entities: { entities: [] },
      response: { intent: "GENERIC", summary: "GENERIC" },
    });

    const { client, seenModels } = makeOpenAIRecorder({ failFirstStreamWith429: true });
    openAIHolder.current = client;

    const mod = await import("../services/assistant.service.js");
    await mod.runAssistantStreamPipeline(
      "hello",
      "/tmp",
      () => {},
      { request_id: "req-1", workspace_id: "ws-1", conversation_id: "conv-1" },
      "conv-1",
      [],
      undefined,
      "agent",
      "auto",
    );
    expect(seenModels.length).toBeGreaterThanOrEqual(2);
    expect(seenModels[0]).toBe("gpt-4o-mini");
    expect(seenModels[1]).toBe("gpt-4o");
  });
});

