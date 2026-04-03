/**
 * G.36 + G.37 — Route + service tests for editor routes.
 *
 * POST /editor/inline-complete (G.36):
 *  1-7. Kill-switch, validation, happy path, prompt construction, env parsing.
 *
 * POST /editor/inline-edit (G.37):
 *  8. Kill-switch off → 404
 *  9. Kill-switch on + missing instruction → 400
 *  10. Kill-switch on + happy path → 200 with modifiedFileContent
 *  11. Kill-switch on + with selection → 200 (selection forwarded)
 *  12. Service throws → 500
 *  13. buildEditPrompt: selection section, fence stripping
 *  14. isInlineEditEnabled: env parsing
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGenerateInlineCompletion, mockGenerateInlineEdit, mockWorkflowLog } = vi.hoisted(() => ({
  mockGenerateInlineCompletion: vi.fn(),
  mockGenerateInlineEdit: vi.fn(),
  mockWorkflowLog: vi.fn(),
}));

vi.mock("../lib/inline-completion.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/inline-completion.service.js")>();
  return {
    ...actual,
    generateInlineCompletion: mockGenerateInlineCompletion,
  };
});

vi.mock("../lib/inline-edit.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/inline-edit.service.js")>();
  return {
    ...actual,
    generateInlineEdit: mockGenerateInlineEdit,
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

import { editorRoutes } from "./editor.routes.js";
import {
  isInlineCompletionEnabled,
  buildCompletionPrompt,
  MAX_BEFORE_CHARS,
  MAX_AFTER_CHARS,
} from "../lib/inline-completion.service.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_BODY = {
  workspacePath: "/Users/test/project",
  filePath: "src/index.ts",
  languageId: "typescript",
  textBeforeCursor: "function greet(name: string) {\n  return ",
  textAfterCursor: "\n}",
  cursorLine: 2,
  cursorColumn: 10,
};

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(editorRoutes);
  await app.ready();
  return app;
}

function post(app: FastifyInstance, body: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/editor/inline-complete",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// 1. Kill-switch off
// ---------------------------------------------------------------------------

describe("POST /editor/inline-complete — disabled (default)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    delete process.env.VIPER_INLINE_COMPLETION_ENABLED;
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 when VIPER_INLINE_COMPLETION_ENABLED is not set", async () => {
    const res = await post(app, VALID_BODY);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// 2-5. Kill-switch on
// ---------------------------------------------------------------------------

describe("POST /editor/inline-complete — enabled", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.VIPER_INLINE_COMPLETION_ENABLED = "1";
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.VIPER_INLINE_COMPLETION_ENABLED;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when required field is missing (filePath)", async () => {
    const { filePath: _, ...body } = VALID_BODY;
    const res = await post(app, body);
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with empty text when textBeforeCursor is whitespace-only", async () => {
    mockGenerateInlineCompletion.mockResolvedValue({ text: "" });
    const res = await post(app, { ...VALID_BODY, textBeforeCursor: "   " });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { text: string };
    expect(body.text).toBe("");
  });

  it("returns 200 with completion text on happy path", async () => {
    mockGenerateInlineCompletion.mockResolvedValue({ text: "`Hello, ${name}`;" });
    const res = await post(app, VALID_BODY);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { text: string };
    expect(body.text).toBe("`Hello, ${name}`;");
  });

  it("returns 200 empty text when generateInlineCompletion returns empty", async () => {
    mockGenerateInlineCompletion.mockResolvedValue({ text: "" });
    const res = await post(app, VALID_BODY);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).text).toBe("");
  });

  it("forwards all fields to generateInlineCompletion", async () => {
    mockGenerateInlineCompletion.mockResolvedValue({ text: "result" });
    await post(app, VALID_BODY);
    expect(mockGenerateInlineCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        workspacePath: VALID_BODY.workspacePath,
        filePath: VALID_BODY.filePath,
        languageId: VALID_BODY.languageId,
        textBeforeCursor: VALID_BODY.textBeforeCursor,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 6. buildCompletionPrompt — unit tests (pure, no network)
// ---------------------------------------------------------------------------

describe("buildCompletionPrompt", () => {
  it("includes languageId in prompt", () => {
    const prompt = buildCompletionPrompt("python", "def greet():", "");
    expect(prompt).toContain("python");
  });

  it("includes text before cursor", () => {
    const prompt = buildCompletionPrompt("typescript", "const x = ", "");
    expect(prompt).toContain("const x = ");
  });

  it("includes text after cursor when provided", () => {
    const prompt = buildCompletionPrompt("javascript", "let a = ", ";\nconst b = 2;");
    expect(prompt).toContain(";\nconst b = 2;");
  });

  it("truncates textBeforeCursor to MAX_BEFORE_CHARS", () => {
    const longBefore = "x".repeat(MAX_BEFORE_CHARS + 1_000);
    const prompt = buildCompletionPrompt("typescript", longBefore, "");
    // The truncated version should be at most MAX_BEFORE_CHARS chars in the prompt
    const beforeSection = longBefore.slice(-MAX_BEFORE_CHARS);
    expect(prompt).toContain(beforeSection);
    // The full long string should NOT be present
    expect(prompt.length).toBeLessThan(longBefore.length + 500);
  });

  it("truncates textAfterCursor to MAX_AFTER_CHARS", () => {
    const longAfter = "y".repeat(MAX_AFTER_CHARS + 1_000);
    const prompt = buildCompletionPrompt("python", "x = ", longAfter);
    const afterSection = longAfter.slice(0, MAX_AFTER_CHARS);
    expect(prompt).toContain(afterSection);
  });

  it("omits after-cursor section when empty", () => {
    const prompt = buildCompletionPrompt("go", "fmt.Println(", "");
    expect(prompt).not.toContain("Code after cursor");
  });
});

// ---------------------------------------------------------------------------
// 7. isInlineCompletionEnabled — env parsing
// ---------------------------------------------------------------------------

describe("isInlineCompletionEnabled", () => {
  afterEach(() => {
    delete process.env.VIPER_INLINE_COMPLETION_ENABLED;
  });

  it("returns false when unset", () => {
    expect(isInlineCompletionEnabled()).toBe(false);
  });

  it("returns true when set to '1'", () => {
    process.env.VIPER_INLINE_COMPLETION_ENABLED = "1";
    expect(isInlineCompletionEnabled()).toBe(true);
  });

  it("returns true when set to 'true'", () => {
    process.env.VIPER_INLINE_COMPLETION_ENABLED = "true";
    expect(isInlineCompletionEnabled()).toBe(true);
  });

  it("returns false for other values", () => {
    process.env.VIPER_INLINE_COMPLETION_ENABLED = "yes";
    expect(isInlineCompletionEnabled()).toBe(false);
  });
});

// ===========================================================================
// G.37 — POST /editor/inline-edit
// ===========================================================================

import {
  isInlineEditEnabled,
  buildEditPrompt,
  stripMarkdownFences,
} from "../lib/inline-edit.service.js";

const EDIT_BODY = {
  workspacePath: "/Users/test/project",
  filePath: "src/index.ts",
  languageId: "typescript",
  instruction: "Add a return type annotation",
  fileContent: "function greet(name: string) {\n  return `Hello, ${name}`;\n}\n",
};

// ---------------------------------------------------------------------------
// 8. Kill-switch off
// ---------------------------------------------------------------------------

describe("POST /editor/inline-edit — disabled (default)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    delete process.env.VIPER_INLINE_EDIT_ENABLED;
    delete process.env.VIPER_INLINE_COMPLETION_ENABLED;
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 when VIPER_INLINE_EDIT_ENABLED is not set", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/editor/inline-edit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(EDIT_BODY),
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 9-12. Kill-switch on
// ---------------------------------------------------------------------------

describe("POST /editor/inline-edit — enabled", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.VIPER_INLINE_EDIT_ENABLED = "1";
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.VIPER_INLINE_EDIT_ENABLED;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function postEdit(body: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: "/editor/inline-edit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when instruction is missing", async () => {
    const { instruction: _, ...body } = EDIT_BODY;
    const res = await postEdit(body);
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with modifiedFileContent on happy path", async () => {
    const modified = "function greet(name: string): string {\n  return `Hello, ${name}`;\n}\n";
    mockGenerateInlineEdit.mockResolvedValue({ modifiedFileContent: modified });
    const res = await postEdit(EDIT_BODY);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { modifiedFileContent: string };
    expect(body.modifiedFileContent).toBe(modified);
  });

  it("forwards selection to generateInlineEdit", async () => {
    mockGenerateInlineEdit.mockResolvedValue({ modifiedFileContent: "modified" });
    const bodyWithSelection = {
      ...EDIT_BODY,
      selection: { startLine: 1, startColumn: 1, endLine: 2, endColumn: 30 },
      selectionText: "function greet(name: string) {\n  return `Hello, ${name}`;",
    };
    const res = await postEdit(bodyWithSelection);
    expect(res.statusCode).toBe(200);
    expect(mockGenerateInlineEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: expect.objectContaining({ startLine: 1, endLine: 2 }),
        selectionText: expect.stringContaining("function greet"),
      }),
    );
  });

  it("returns 500 when generateInlineEdit throws", async () => {
    mockGenerateInlineEdit.mockRejectedValue(new Error("OpenAI timeout"));
    const res = await postEdit(EDIT_BODY);
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toMatch(/OpenAI timeout/);
  });
});

// ---------------------------------------------------------------------------
// 13. buildEditPrompt + stripMarkdownFences — unit tests
// ---------------------------------------------------------------------------

describe("buildEditPrompt", () => {
  it("includes languageId and file path", () => {
    const prompt = buildEditPrompt({
      workspacePath: "/tmp",
      filePath: "src/foo.py",
      languageId: "python",
      instruction: "add docstring",
      fileContent: "def greet():\n  pass",
    });
    expect(prompt).toContain("python");
    expect(prompt).toContain("src/foo.py");
  });

  it("includes selection section when provided", () => {
    const prompt = buildEditPrompt({
      workspacePath: "/tmp",
      filePath: "src/foo.ts",
      languageId: "typescript",
      instruction: "add type",
      fileContent: "const x = 1;",
      selection: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 13 },
      selectionText: "const x = 1;",
    });
    expect(prompt).toContain("lines 1–1");
    expect(prompt).toContain("const x = 1;");
  });

  it("omits selection section when not provided", () => {
    const prompt = buildEditPrompt({
      workspacePath: "/tmp",
      filePath: "f.ts",
      languageId: "typescript",
      instruction: "refactor",
      fileContent: "const x = 1;",
    });
    expect(prompt).not.toContain("selected");
  });
});

describe("stripMarkdownFences", () => {
  it("strips ```typescript ... ``` fences", () => {
    const input = "```typescript\nconst x = 1;\n```";
    expect(stripMarkdownFences(input)).toBe("const x = 1;");
  });

  it("strips ```python fences", () => {
    const input = "```python\ndef f():\n  pass\n```";
    expect(stripMarkdownFences(input)).toBe("def f():\n  pass");
  });

  it("returns plain text unchanged", () => {
    const input = "const x = 1;\nconst y = 2;";
    expect(stripMarkdownFences(input)).toBe(input);
  });

  it("returns partial fences unchanged", () => {
    const input = "```typescript\nconst x = 1;";
    expect(stripMarkdownFences(input)).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// 14. isInlineEditEnabled — env parsing
// ---------------------------------------------------------------------------

describe("isInlineEditEnabled", () => {
  afterEach(() => {
    delete process.env.VIPER_INLINE_EDIT_ENABLED;
  });

  it("returns false when unset", () => {
    expect(isInlineEditEnabled()).toBe(false);
  });

  it("returns true when '1'", () => {
    process.env.VIPER_INLINE_EDIT_ENABLED = "1";
    expect(isInlineEditEnabled()).toBe(true);
  });

  it("returns true when 'true'", () => {
    process.env.VIPER_INLINE_EDIT_ENABLED = "true";
    expect(isInlineEditEnabled()).toBe(true);
  });

  it("returns false for other values", () => {
    process.env.VIPER_INLINE_EDIT_ENABLED = "on";
    expect(isInlineEditEnabled()).toBe(false);
  });
});
