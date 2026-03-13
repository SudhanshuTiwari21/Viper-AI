import { describe, it, expect } from "vitest";
import { normalizePrompt } from "./normalize-prompt";

describe("Prompt Normalizer", () => {
  it("normalizes and expands shorthand for simple API fix request", () => {
    const input = "fix login api pls";

    const result = normalizePrompt(input);

    expect(result.normalized).toBe("Fix login API");
    expect(result.tokens).toEqual(["fix", "login", "api"]);
    expect(result.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "function", value: "login" }),
      ]),
    );
  });

  it("detects file references like login.ts", () => {
    const input = "fix login.ts bug";

    const result = normalizePrompt(input);

    expect(result.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "file", value: "login.ts" }),
      ]),
    );
  });

  it("expands auth svc shorthand", () => {
    const input = "refactor auth svc";

    const result = normalizePrompt(input);

    expect(result.normalized).toBe("Refactor authentication service");
    expect(result.tokens).toEqual(["refactor", "authentication", "service"]);
  });

  it("detects camelCase function references", () => {
    const input = "explain validatePassword function";

    const result = normalizePrompt(input);

    expect(result.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "function",
          value: "validatePassword",
        }),
      ]),
    );
  });
});

