/**
 * G.39 — Route + service unit tests for /testing/* endpoints.
 *
 * Coverage:
 * Route tests (with mocked service):
 *  1. Kill-switch off → 404 (both endpoints)
 *  2. /testing/suggest-commands missing changedFiles → 400
 *  3. /testing/suggest-commands empty array → 400
 *  4. /testing/suggest-commands happy path → 200 { commands }
 *  5. /testing/suggest-commands service throws → 500
 *  6. /testing/triage-failure missing runnerOutput → 400
 *  7. /testing/triage-failure happy path → 200 { summary, bullets, suggestedCommands }
 *  8. /testing/triage-failure service throws → 500
 *
 * Heuristic unit tests (pure, no network):
 *  9.  deriveTestFilePath: .ts → .test.ts
 * 10.  deriveTestFilePath: .tsx → .test.tsx
 * 11.  deriveTestFilePath: already .test.ts → unchanged
 * 12.  deriveTestFilePath: no extension → null
 * 13.  buildHeuristicCommands: backend file → vitest run command
 * 14.  buildHeuristicCommands: database file → npm test in packages/database
 * 15.  buildHeuristicCommands: unknown package → no commands
 * 16.  buildHeuristicCommands: many backend files → run all
 * 17.  isTestAssistantEnabled: env parsing
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockSuggestTestCommands, mockTriageFailure, mockWorkflowLog } = vi.hoisted(() => ({
  mockSuggestTestCommands: vi.fn(),
  mockTriageFailure: vi.fn(),
  mockWorkflowLog: vi.fn(),
}));

vi.mock("../lib/test-assistant.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/test-assistant.service.js")>();
  return {
    ...actual,
    suggestTestCommands: mockSuggestTestCommands,
    triageFailure: mockTriageFailure,
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
// App builder
// ---------------------------------------------------------------------------

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { testingRoutes } = await import("./testing.routes.js");
  await app.register(testingRoutes);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// 1. Kill-switch off
// ---------------------------------------------------------------------------

describe("kill-switch off", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    delete process.env.VIPER_TEST_ASSISTANT_ENABLED;
    app = await buildApp();
  });

  afterAll(async () => { await app.close(); });

  it("POST /testing/suggest-commands → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/testing/suggest-commands",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspacePath: "/tmp",
        changedFiles: ["apps/backend/src/foo.ts"],
      }),
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /testing/triage-failure → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/testing/triage-failure",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspacePath: "/tmp", runnerOutput: "FAIL" }),
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 2-8. Kill-switch on
// ---------------------------------------------------------------------------

describe("kill-switch on", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.VIPER_TEST_ASSISTANT_ENABLED = "1";
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.VIPER_TEST_ASSISTANT_ENABLED;
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

  // 2. Missing changedFiles
  it("missing changedFiles → 400", async () => {
    const res = await post("/testing/suggest-commands", { workspacePath: "/tmp" });
    expect(res.statusCode).toBe(400);
  });

  // 3. Empty changedFiles array
  it("empty changedFiles → 400", async () => {
    const res = await post("/testing/suggest-commands", {
      workspacePath: "/tmp",
      changedFiles: [],
    });
    expect(res.statusCode).toBe(400);
  });

  // 4. Happy path suggest
  it("POST /testing/suggest-commands happy path → 200", async () => {
    mockSuggestTestCommands.mockResolvedValue({
      commands: [
        {
          cwd: "apps/backend",
          shell: "npx vitest run src/lib/foo.test.ts",
          rationale: "Changed foo.ts",
        },
      ],
    });
    const res = await post("/testing/suggest-commands", {
      workspacePath: "/Users/test/repo",
      changedFiles: ["apps/backend/src/lib/foo.ts"],
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { commands: unknown[] };
    expect(body.commands).toHaveLength(1);
  });

  // 5. Service throws
  it("service throws → 500", async () => {
    mockSuggestTestCommands.mockRejectedValue(new Error("OpenAI down"));
    const res = await post("/testing/suggest-commands", {
      workspacePath: "/tmp",
      changedFiles: ["apps/backend/src/foo.ts"],
    });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toMatch(/OpenAI down/);
  });

  // 6. Missing runnerOutput
  it("missing runnerOutput → 400", async () => {
    const res = await post("/testing/triage-failure", { workspacePath: "/tmp" });
    expect(res.statusCode).toBe(400);
  });

  // 7. Triage happy path
  it("POST /testing/triage-failure happy path → 200", async () => {
    mockTriageFailure.mockResolvedValue({
      summary: "AuthService test failed due to missing env var.",
      bullets: ["Test: auth.test.ts > should login", "Error: OPENAI_API_KEY not set"],
      suggestedCommands: ["OPENAI_API_KEY=sk-test npx vitest run src/lib/auth.test.ts"],
    });
    const res = await post("/testing/triage-failure", {
      workspacePath: "/tmp",
      runnerOutput: "FAIL src/lib/auth.test.ts\n× should login",
      runner: "vitest",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      summary: string;
      bullets: string[];
      suggestedCommands: string[];
    };
    expect(body.summary).toContain("AuthService");
    expect(body.bullets).toHaveLength(2);
    expect(body.suggestedCommands).toHaveLength(1);
  });

  // 8. Triage service throws
  it("triage service throws → 500", async () => {
    mockTriageFailure.mockRejectedValue(new Error("timeout"));
    const res = await post("/testing/triage-failure", {
      workspacePath: "/tmp",
      runnerOutput: "FAIL",
    });
    expect(res.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// 9-16. Heuristic unit tests
// ---------------------------------------------------------------------------

import {
  deriveTestFilePath,
  buildHeuristicCommands,
  isTestAssistantEnabled,
} from "../lib/test-assistant.service.js";

describe("deriveTestFilePath", () => {
  it(".ts source → .test.ts", () => {
    expect(deriveTestFilePath("apps/backend/src/lib/foo.ts")).toBe(
      "apps/backend/src/lib/foo.test.ts",
    );
  });

  it(".tsx source → .test.tsx", () => {
    expect(deriveTestFilePath("apps/viper-desktop/ui/components/Bar.tsx")).toBe(
      "apps/viper-desktop/ui/components/Bar.test.tsx",
    );
  });

  it("already .test.ts → unchanged", () => {
    expect(deriveTestFilePath("apps/backend/src/lib/foo.test.ts")).toBe(
      "apps/backend/src/lib/foo.test.ts",
    );
  });

  it("no extension → null", () => {
    expect(deriveTestFilePath("apps/backend/Makefile")).toBeNull();
  });

  it(".spec.ts → unchanged", () => {
    expect(deriveTestFilePath("src/foo.spec.ts")).toBe("src/foo.spec.ts");
  });
});

describe("buildHeuristicCommands", () => {
  it("backend file → vitest run specific test", () => {
    const cmds = buildHeuristicCommands([
      "apps/backend/src/lib/quota.service.ts",
    ]);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]!.cwd).toBe("apps/backend");
    expect(cmds[0]!.shell).toContain("vitest run");
    expect(cmds[0]!.shell).toContain("quota.service.test.ts");
  });

  it("database file → vitest run in packages/database", () => {
    const cmds = buildHeuristicCommands([
      "packages/database/src/auth-workspaces.repository.ts",
    ]);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]!.cwd).toBe("packages/database");
    expect(cmds[0]!.shell).toContain("vitest run");
  });

  it("unknown package → no commands", () => {
    const cmds = buildHeuristicCommands(["some/unknown/path/foo.ts"]);
    expect(cmds).toHaveLength(0);
  });

  it("many backend files → run all (not per-file)", () => {
    const files = Array.from(
      { length: 5 },
      (_, i) => `apps/backend/src/lib/file${i}.ts`,
    );
    const cmds = buildHeuristicCommands(files);
    // More than 3 test files → run all
    const backendCmd = cmds.find((c) => c.cwd === "apps/backend");
    expect(backendCmd).toBeDefined();
    expect(backendCmd!.shell).toBe("npx vitest run");
  });

  it("multiple packages → one command per package", () => {
    const cmds = buildHeuristicCommands([
      "apps/backend/src/lib/foo.ts",
      "packages/database/src/bar.ts",
    ]);
    const cwds = cmds.map((c) => c.cwd);
    expect(cwds).toContain("apps/backend");
    expect(cwds).toContain("packages/database");
  });
});

// ---------------------------------------------------------------------------
// 17. isTestAssistantEnabled
// ---------------------------------------------------------------------------

describe("isTestAssistantEnabled", () => {
  afterEach(() => { delete process.env.VIPER_TEST_ASSISTANT_ENABLED; });

  it("false when unset", () => { expect(isTestAssistantEnabled()).toBe(false); });
  it("true for '1'", () => {
    process.env.VIPER_TEST_ASSISTANT_ENABLED = "1";
    expect(isTestAssistantEnabled()).toBe(true);
  });
  it("true for 'true'", () => {
    process.env.VIPER_TEST_ASSISTANT_ENABLED = "true";
    expect(isTestAssistantEnabled()).toBe(true);
  });
  it("false for other values", () => {
    process.env.VIPER_TEST_ASSISTANT_ENABLED = "yes";
    expect(isTestAssistantEnabled()).toBe(false);
  });
});
