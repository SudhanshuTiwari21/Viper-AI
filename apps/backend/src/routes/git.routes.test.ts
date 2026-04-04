/**
 * G.38 — Route tests for /git/suggest-commit and /git/suggest-pr-body.
 *
 * Coverage:
 *  1. Kill-switch off → 404 for both endpoints
 *  2. Kill-switch on + missing stagedDiff → 400
 *  3. Kill-switch on + happy path commit → 200 { subject, body }
 *  4. Kill-switch on + style: "short" forwarded to service
 *  5. Kill-switch on + service throws → 500
 *  6. Kill-switch on + happy path PR body → 200 { title, body }
 *  7. Kill-switch on + missing workspacePath → 400
 *  8. buildCommitPrompt: includes diff, style guide, branch hint
 *  9. buildPrPrompt: includes diff, branch hint, section headings
 * 10. isCommitAssistantEnabled: env parsing
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockSuggestCommit, mockSuggestPr, mockWorkflowLog } = vi.hoisted(() => ({
  mockSuggestCommit: vi.fn(),
  mockSuggestPr: vi.fn(),
  mockWorkflowLog: vi.fn(),
}));

vi.mock("../lib/git-assistant.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/git-assistant.service.js")>();
  return {
    ...actual,
    suggestCommitMessage: mockSuggestCommit,
    suggestPrBody: mockSuggestPr,
  };
});

vi.mock("../middleware/entitlements.middleware.js", () => ({
  entitlementsPreHandler: async (req: { entitlements?: null }, _reply: unknown) => {
    req.entitlements = null;
  },
}));

vi.mock("../services/assistant.service.js", () => ({
  workflowLog: mockWorkflowLog,
}));

// ---------------------------------------------------------------------------
// Helper: build app
// ---------------------------------------------------------------------------

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { gitRoutes } = await import("./git.routes.js");
  await app.register(gitRoutes);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// 1. Kill-switch off
// ---------------------------------------------------------------------------

describe("kill-switch off (default)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    delete process.env.VIPER_COMMIT_ASSISTANT_ENABLED;
    app = await buildApp();
  });

  afterAll(async () => { await app.close(); });

  it("POST /git/suggest-commit → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/git/suggest-commit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspacePath: "/tmp/x", stagedDiff: "diff" }),
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /git/suggest-pr-body → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/git/suggest-pr-body",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspacePath: "/tmp/x", stagedDiff: "diff" }),
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 2-7. Kill-switch on
// ---------------------------------------------------------------------------

describe("kill-switch on", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.VIPER_COMMIT_ASSISTANT_ENABLED = "1";
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.VIPER_COMMIT_ASSISTANT_ENABLED;
  });

  afterEach(() => { vi.clearAllMocks(); });

  function post(url: string, body: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // 2. Validation errors
  it("missing stagedDiff → 400", async () => {
    const res = await post("/git/suggest-commit", { workspacePath: "/tmp/x" });
    expect(res.statusCode).toBe(400);
  });

  it("missing workspacePath → 400", async () => {
    const res = await post("/git/suggest-commit", { stagedDiff: "diff" });
    expect(res.statusCode).toBe(400);
  });

  // 3. Happy path commit
  it("POST /git/suggest-commit → 200 { subject, body }", async () => {
    mockSuggestCommit.mockResolvedValue({
      subject: "feat(auth): add OAuth2 login",
      body: "Implements Google OAuth2 flow.\n\nCloses #42.",
    });
    const res = await post("/git/suggest-commit", {
      workspacePath: "/Users/test/repo",
      stagedDiff: "diff --git a/auth.ts ...",
      style: "conventional",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { subject: string; body: string };
    expect(body.subject).toBe("feat(auth): add OAuth2 login");
    expect(body.body).toContain("Google OAuth2");
  });

  // 4. style forwarded
  it("style: 'short' is forwarded to suggestCommitMessage", async () => {
    mockSuggestCommit.mockResolvedValue({ subject: "add login" });
    await post("/git/suggest-commit", {
      workspacePath: "/tmp",
      stagedDiff: "diff",
      style: "short",
    });
    expect(mockSuggestCommit).toHaveBeenCalledWith(
      expect.objectContaining({ style: "short" }),
    );
  });

  // 5. Service throws → 500
  it("service throws → 500", async () => {
    mockSuggestCommit.mockRejectedValue(new Error("OpenAI unavailable"));
    const res = await post("/git/suggest-commit", {
      workspacePath: "/tmp",
      stagedDiff: "diff",
    });
    expect(res.statusCode).toBe(500);
    const b = JSON.parse(res.body) as { error: string };
    expect(b.error).toMatch(/OpenAI unavailable/);
  });

  // 6. PR happy path
  it("POST /git/suggest-pr-body → 200 { title, body }", async () => {
    mockSuggestPr.mockResolvedValue({
      title: "feat: add OAuth2 login",
      body: "## Summary\n- Add Google OAuth2\n\n## Test plan\n- Unit tests pass",
    });
    const res = await post("/git/suggest-pr-body", {
      workspacePath: "/Users/test/repo",
      stagedDiff: "diff --git a/auth.ts ...",
      branch: "feature/oauth",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { title: string; body: string };
    expect(body.title).toBe("feat: add OAuth2 login");
    expect(body.body).toContain("## Summary");
  });
});

// ---------------------------------------------------------------------------
// 8-9. Prompt builders
// ---------------------------------------------------------------------------

import {
  buildCommitPrompt,
  buildPrPrompt,
  isCommitAssistantEnabled,
} from "../lib/git-assistant.service.js";

describe("buildCommitPrompt", () => {
  it("includes staged diff", () => {
    const p = buildCommitPrompt("diff --git a/foo.ts", "conventional");
    expect(p).toContain("diff --git a/foo.ts");
  });

  it("includes conventional commits guidance for 'conventional' style", () => {
    const p = buildCommitPrompt("diff", "conventional");
    expect(p).toContain("Conventional Commits");
    expect(p).toContain("feat");
  });

  it("includes concise guidance for 'short' style", () => {
    const p = buildCommitPrompt("diff", "short");
    expect(p).toContain("concise");
    expect(p).not.toContain("Conventional Commits");
  });

  it("includes branch hint when provided", () => {
    const p = buildCommitPrompt("diff", "conventional", "feature/auth");
    expect(p).toContain("feature/auth");
  });

  it("omits branch hint when not provided", () => {
    const p = buildCommitPrompt("diff", "short");
    expect(p).not.toContain("Current branch:");
  });

  it("truncates long diffs", () => {
    const longDiff = "x".repeat(100_000);
    const p = buildCommitPrompt(longDiff, "conventional");
    expect(p.length).toBeLessThan(longDiff.length + 1_000);
  });
});

describe("buildPrPrompt", () => {
  it("includes staged diff", () => {
    const p = buildPrPrompt("diff --git a/bar.ts");
    expect(p).toContain("diff --git a/bar.ts");
  });

  it("includes PR section headings", () => {
    const p = buildPrPrompt("diff");
    expect(p).toContain("Summary");
    expect(p).toContain("Changes");
    expect(p).toContain("Test plan");
  });

  it("includes branch hint when provided", () => {
    const p = buildPrPrompt("diff", "feature/my-branch");
    expect(p).toContain("feature/my-branch");
  });
});

// ---------------------------------------------------------------------------
// 10. isCommitAssistantEnabled env parsing
// ---------------------------------------------------------------------------

describe("isCommitAssistantEnabled", () => {
  afterEach(() => { delete process.env.VIPER_COMMIT_ASSISTANT_ENABLED; });

  it("returns false when unset", () => {
    expect(isCommitAssistantEnabled()).toBe(false);
  });

  it("returns true for '1'", () => {
    process.env.VIPER_COMMIT_ASSISTANT_ENABLED = "1";
    expect(isCommitAssistantEnabled()).toBe(true);
  });

  it("returns true for 'true'", () => {
    process.env.VIPER_COMMIT_ASSISTANT_ENABLED = "true";
    expect(isCommitAssistantEnabled()).toBe(true);
  });

  it("returns false for other values", () => {
    process.env.VIPER_COMMIT_ASSISTANT_ENABLED = "yes";
    expect(isCommitAssistantEnabled()).toBe(false);
  });
});
