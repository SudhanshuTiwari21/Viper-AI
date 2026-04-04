import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Ensure workflow flags are read with deterministic values at module import time.
vi.hoisted(() => {
  process.env.VIPER_ENABLE_STREAM_CONTEXT_PRIMER = "false";
  process.env.VIPER_STREAM_ANALYSIS_WARMUP_MS = "0";
  process.env.VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS = "0";
  process.env.VIPER_REQUIRE_ANALYSIS_FOR_EDITS = "false";
  process.env.VIPER_MIN_FILES_READ_BEFORE_EDIT = "0";
  process.env.VIPER_MIN_DISCOVERY_TOOLS_BEFORE_EDIT = "0";
  process.env.VIPER_DEBUG_ASSISTANT = "0";
  process.env.VIPER_DEBUG_WORKFLOW = "1";
  process.env.OPENAI_API_KEY = "test";
});

type OpenAIChunk = {
  choices: Array<{
    delta: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
};

function streamFromChunks(chunks: OpenAIChunk[]) {
  return (async function* () {
    for (const c of chunks) yield c;
  })();
}

function makeFakeOpenAI(sequences: Array<OpenAIChunk[]>) {
  let callIdx = 0;
  return {
    chat: {
      completions: {
        create: vi.fn(async () => {
          const seq = sequences[Math.min(callIdx, sequences.length - 1)] ?? [];
          callIdx++;
          return streamFromChunks(seq);
        }),
      },
    },
  } as unknown as import("openai").default;
}

// Mock OpenAI SDK constructor to return our per-test fake client.
const openAIHolder = vi.hoisted(() => ({ current: null as null | unknown }));
vi.mock("openai", () => ({
  default: class OpenAI {
    constructor() {
      if (!openAIHolder.current) throw new Error("Test OpenAI client not set");
      return openAIHolder.current as any;
    }
  },
}));

// Mock DB/memory so tests never touch Postgres.
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

// Mock intent pipeline so routing is deterministic (no OpenAI).
const intentMock = vi.hoisted(() => ({
  runIntentPipeline: vi.fn(),
}));
vi.mock("../lib/intent-agent-loader.js", () => ({
  runIntentPipeline: intentMock.runIntentPipeline,
  getIntentAgentAdapter: vi.fn(async () => ({})),
  runIntentReasoning: vi.fn(async () => ({ content: "" })),
}));

// Mock analysis warmup so nothing async / external happens.
vi.mock("../services/analysis-options.service.js", () => ({
  runCodebaseAnalysisIfConfigured: vi.fn(async () => false),
}));

// Mock workspace-tools runWorkspaceCommand to be deterministic (used by run_command tool).
vi.mock("@repo/workspace-tools", async () => {
  const actual = await vi.importActual<typeof import("@repo/workspace-tools")>("@repo/workspace-tools");
  return {
    ...actual,
    runWorkspaceCommand: vi.fn(async () => ({
      success: true,
      exitCode: 0,
      output: "typecheck: ok",
      error: "",
    })),
  };
});

async function runStream(opts: {
  mode: "ask" | "plan" | "debug" | "agent";
  prompt: string;
  openAI: unknown;
  workspacePath: string;
  modelTier?: "auto" | "premium";
}) {
  openAIHolder.current = opts.openAI;
  const mod = await import("../services/assistant.service.js");
  const events: Array<{ type: string; data: unknown }> = [];
  await mod.runAssistantStreamPipeline(
    opts.prompt,
    opts.workspacePath,
    (e) => events.push(e),
    { request_id: "req-1", workspace_id: "ws-1", conversation_id: "conv-1" },
    "conv-1",
    [],
    undefined,
    opts.mode,
    opts.modelTier ?? "auto",
    null,
  );
  return events;
}

function getResultSnippet(events: Array<{ type: string; data: any }>): string {
  const r = events.find((e) => e.type === "result")?.data;
  const snip = r?.context?.snippets?.[0];
  if (typeof snip !== "string") throw new Error("Missing result snippet");
  return snip;
}

function hasEvent(events: Array<{ type: string; data: any }>, type: string): boolean {
  return events.some((e) => e.type === type);
}

describe("C.15 integration: backend mode contract (streaming boundary)", () => {
  let workspacePath = "";

  beforeAll(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), "viperai-mode-contract-"));
    await writeFile(join(workspacePath, "package.json"), JSON.stringify({ name: "tmp", version: "0.0.0" }, null, 2));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    openAIHolder.current = null;
  });

  it("ASK: read-only, direct answer contract, no tool:start events", async () => {
    intentMock.runIntentPipeline.mockResolvedValue({
      intent: { intentType: "GENERIC" },
      entities: { entities: [] },
      response: { intent: "GENERIC", summary: "GENERIC" },
    });
    const openAI = makeFakeOpenAI([
      [
        { choices: [{ delta: { content: "Here is my response without headings." } }] },
      ],
    ]);
    const events = await runStream({ mode: "ask", prompt: "Create file foo.txt and write hello", openAI, workspacePath });

    const snippet = getResultSnippet(events);
    expect(snippet).toContain("Answer");
    expect(hasEvent(events, "tool:start")).toBe(false);
  });

  it("PLAN: structured plan contract, no tool:start events", async () => {
    intentMock.runIntentPipeline.mockResolvedValue({
      intent: { intentType: "GENERIC" },
      entities: { entities: [] },
      response: { intent: "GENERIC", summary: "GENERIC" },
    });
    const openAI = makeFakeOpenAI([
      [
        { choices: [{ delta: { content: "Plan\n1. Do X." } }] },
      ],
    ]);
    const events = await runStream({ mode: "plan", prompt: "Plan how to add feature X", openAI, workspacePath });

    const snippet = getResultSnippet(events);
    expect(snippet).toContain("Plan");
    expect(snippet).toContain("Risks / tradeoffs");
    expect(snippet).toContain("Next actions");
    expect(hasEvent(events, "tool:start")).toBe(false);
  });

  it("DEBUG: allows run_command, blocks edits if attempted, evidence-first headings present", async () => {
    intentMock.runIntentPipeline.mockResolvedValue({
      intent: { intentType: "CODE_FIX" },
      entities: { entities: [] },
      response: { intent: "CODE_FIX", summary: "CODE_FIX" },
    });
    const openAI = makeFakeOpenAI([
      [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: "tc1", function: { name: "run_command", arguments: "{\"command\":\"npm run check-types\"}" } },
                  { index: 1, id: "tc2", function: { name: "edit_file", arguments: "{\"path\":\"x\",\"old_text\":\"a\",\"new_text\":\"b\"}" } },
                ],
              },
            },
          ],
        },
      ],
      [
        { choices: [{ delta: { content: "Observations\n- typecheck ok\n\nRecommendation\nNo edits." } }] },
      ],
    ]);
    const events = await runStream({ mode: "debug", prompt: "Run typecheck and fix it", openAI, workspacePath });

    expect(hasEvent(events, "tool:start")).toBe(true);
    const snippet = getResultSnippet(events);
    expect(snippet).toContain("Observations");
    expect(snippet).toContain("Hypotheses"); // appended if missing
    expect(snippet).toContain("Recommendation");

    const gate = events.find((e) => e.type === "workflow:gate")?.data as any;
    expect(gate?.reason).toBe("mode_tool_blocked");
  });

  it("AGENT: can emit tool events and result includes Summary heading", async () => {
    intentMock.runIntentPipeline.mockResolvedValue({
      intent: { intentType: "CODE_GUIDANCE" },
      entities: { entities: [] },
      response: { intent: "CODE_GUIDANCE", summary: "CODE_GUIDANCE" },
    });
    const openAI = makeFakeOpenAI([
      [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: "tc1", function: { name: "read_file", arguments: "{\"path\":\"package.json\"}" } },
                ],
              },
            },
          ],
        },
      ],
      [
        { choices: [{ delta: { content: "I read the file." } }] },
      ],
    ]);
    const events = await runStream({ mode: "agent", prompt: "Read package.json", openAI, workspacePath });
    expect(hasEvent(events, "tool:start")).toBe(true);
    const snippet = getResultSnippet(events);
    expect(snippet).toContain("Summary"); // appended if missing
  });
});

