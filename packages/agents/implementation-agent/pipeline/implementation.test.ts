import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runImplementation } from "./run-implementation";
import { buildImplementationPrompt } from "../modules/prompt-builder/build-implementation-prompt";
import { generatePatch } from "../modules/patch-generator/generate-patch";
import { validateChanges } from "../modules/validator/validate-changes";
import { createDiffs } from "../modules/diff-engine/create-diff";
import type { ImplementationInput } from "./implementation.types";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../modules/code-generator/generate-code", () => ({
  generateCode: vi.fn(),
}));

import { generateCode } from "../modules/code-generator/generate-code";
const mockedGenerateCode = vi.mocked(generateCode);

function makeInput(workspacePath: string): ImplementationInput {
  return {
    plan: {
      intent: "CODE_FIX",
      steps: [
        { id: "0-SEARCH_SYMBOL", type: "SEARCH_SYMBOL", description: "Locate symbols", entities: ["login"] },
        { id: "5-GENERATE_PATCH", type: "GENERATE_PATCH", description: "Patch", entities: ["login"] },
      ],
    },
    contextWindow: {
      files: ["src/auth/login.ts"],
      functions: ["loginUser"],
      snippets: ["function loginUser() { return false; }"],
      estimatedTokens: 50,
    },
    prompt: "fix login api",
    workspacePath,
  };
}

let tmpDir: string;

beforeEach(() => {
  vi.clearAllMocks();
  tmpDir = mkdtempSync(join(tmpdir(), "viper-impl-test-"));
  mkdirSync(join(tmpDir, "src/auth"), { recursive: true });
  writeFileSync(
    join(tmpDir, "src/auth/login.ts"),
    "function loginUser() { return false; }",
    "utf-8",
  );
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("runImplementation", () => {
  it("generates patch and applies to filesystem", async () => {
    mockedGenerateCode.mockResolvedValue([
      {
        file: "src/auth/login.ts",
        content: 'export function loginUser() { return true; }\n',
      },
    ]);

    const input = makeInput(tmpDir);
    const result = await runImplementation(input);

    expect(result.success).toBe(true);
    expect(result.patch.changes).toHaveLength(1);
    expect(result.patch.changes[0]!.file).toBe("src/auth/login.ts");
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]!.before).toBe("function loginUser() { return false; }");
    expect(result.diffs[0]!.after).toContain("return true");
    expect(result.logs).toContain("[Viper] Patch applied successfully");

    const written = readFileSync(join(tmpDir, "src/auth/login.ts"), "utf-8");
    expect(written).toBe('export function loginUser() { return true; }\n');
  });

  it("fails validation when content is empty", async () => {
    mockedGenerateCode.mockResolvedValue([
      { file: "src/empty.ts", content: "" },
    ]);

    const input = makeInput(tmpDir);
    const result = await runImplementation(input);

    expect(result.success).toBe(false);
    expect(result.logs.some((l) => l.includes("Validation failed"))).toBe(true);
  });

  it("rejects path traversal", async () => {
    mockedGenerateCode.mockResolvedValue([
      { file: "../../etc/passwd", content: "hacked" },
    ]);

    const input = makeInput(tmpDir);
    const result = await runImplementation(input);

    expect(result.success).toBe(false);
    expect(result.logs.some((l) => l.includes("path traversal"))).toBe(true);
  });
});

describe("buildImplementationPrompt", () => {
  it("includes prompt, plan steps, and context snippets", () => {
    const input = makeInput(tmpDir);
    const prompt = buildImplementationPrompt(input);

    expect(prompt).toContain("fix login api");
    expect(prompt).toContain("SEARCH_SYMBOL");
    expect(prompt).toContain("GENERATE_PATCH");
    expect(prompt).toContain("src/auth/login.ts");
    expect(prompt).toContain("loginUser");
    expect(prompt).toContain("function loginUser()");
  });
});

describe("generatePatch", () => {
  it("wraps FileChange[] into Patch", () => {
    const patch = generatePatch([
      { file: "a.ts", content: "aaa" },
      { file: "b.ts", content: "bbb" },
    ]);
    expect(patch.changes).toHaveLength(2);
    expect(patch.changes[0]!.file).toBe("a.ts");
  });
});

describe("validateChanges", () => {
  it("passes for valid patch", () => {
    const result = validateChanges({
      changes: [{ file: "ok.ts", content: "console.log(1)" }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails for empty patch", () => {
    const result = validateChanges({ changes: [] });
    expect(result.valid).toBe(false);
  });
});

describe("createDiffs", () => {
  it("captures before/after for existing file", () => {
    const diffs = createDiffs(
      { changes: [{ file: "src/auth/login.ts", content: "new content" }] },
      tmpDir,
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.before).toBe("function loginUser() { return false; }");
    expect(diffs[0]!.after).toBe("new content");
  });

  it("returns empty before for new file", () => {
    const diffs = createDiffs(
      { changes: [{ file: "src/new-file.ts", content: "brand new" }] },
      tmpDir,
    );
    expect(diffs[0]!.before).toBe("");
    expect(diffs[0]!.after).toBe("brand new");
  });
});
