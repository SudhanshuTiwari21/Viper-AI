import { describe, it, expect } from "vitest";
import type { NormalizedPrompt } from "../prompt-normalizer/prompt-normalizer.types";
import { extractEntities } from "./extract-entities";

function makePrompt(text: string): NormalizedPrompt {
  return {
    original: text,
    normalized: text,
    tokens: text.toLowerCase().split(/\s+/),
    references: [],
  };
}

describe("Entity Extractor", () => {
  it("extracts API entity from 'fix login api'", () => {
    const prompt = makePrompt("Fix login API");
    const result = extractEntities(prompt);

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "api", value: "login API" }),
      ]),
    );
  });

  it("extracts file entity from 'fix login.ts bug'", () => {
    const prompt = makePrompt("Fix login.ts bug");
    const result = extractEntities(prompt);

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "file", value: "login.ts" }),
      ]),
    );
  });

  it("extracts class entity from 'refactor AuthService'", () => {
    const prompt = makePrompt("Refactor AuthService");
    const result = extractEntities(prompt);

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "class", value: "AuthService" }),
      ]),
    );
  });

  it("extracts module entity from 'modify payment module'", () => {
    const prompt = makePrompt("Modify payment module");
    const result = extractEntities(prompt);

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "module", value: "payment module" }),
      ]),
    );
  });
}
);

