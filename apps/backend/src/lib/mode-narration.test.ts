import { describe, it, expect } from "vitest";
import {
  getModePromptAddendum,
  getRequiredHeadings,
  enforceOutputContract,
} from "./mode-narration.js";
import type { ChatMode } from "../validators/request.schemas.js";

const MODES: ChatMode[] = ["ask", "plan", "debug", "agent"];

describe("getModePromptAddendum", () => {
  it("returns a non-empty string for every mode", () => {
    for (const m of MODES) {
      const addendum = getModePromptAddendum(m);
      expect(addendum.length).toBeGreaterThan(0);
    }
  });

  it("ask addendum mentions 'Answer' and disallows edits", () => {
    const a = getModePromptAddendum("ask");
    expect(a).toContain("Answer");
    expect(a).toContain("Do NOT attempt file edits");
  });

  it("plan addendum requires Plan, Risks / tradeoffs, Next actions", () => {
    const a = getModePromptAddendum("plan");
    expect(a).toContain("Plan");
    expect(a).toContain("Risks / tradeoffs");
    expect(a).toContain("Next actions");
  });

  it("debug addendum requires Observations, Hypotheses, Recommendation", () => {
    const a = getModePromptAddendum("debug");
    expect(a).toContain("Observations");
    expect(a).toContain("Hypotheses");
    expect(a).toContain("Recommendation");
  });

  it("agent addendum requires Summary", () => {
    const a = getModePromptAddendum("agent");
    expect(a).toContain("Summary");
  });
});

describe("getRequiredHeadings", () => {
  it.each<[ChatMode, string[]]>([
    ["ask", ["Answer"]],
    ["plan", ["Plan", "Risks / tradeoffs", "Next actions"]],
    ["debug", ["Observations", "Hypotheses", "Recommendation"]],
    ["agent", ["Summary"]],
  ])("mode=%s requires headings %j", (mode, headings) => {
    expect(getRequiredHeadings(mode)).toEqual(headings);
  });
});

describe("enforceOutputContract", () => {
  it("returns empty string unchanged", () => {
    expect(enforceOutputContract("", "ask")).toBe("");
    expect(enforceOutputContract("  ", "plan")).toBe("  ");
  });

  it("does not modify content that already has all required headings", () => {
    const askContent = "Some preamble\n\nAnswer\nHere is the answer.";
    expect(enforceOutputContract(askContent, "ask")).toBe(askContent);
  });

  it("appends missing headings for ask mode", () => {
    const content = "Here is some response without sections.";
    const result = enforceOutputContract(content, "ask");
    expect(result).toContain("Answer\n(no additional information)");
  });

  it("appends all missing headings for plan mode", () => {
    const content = "Plan\n1. Do the thing.\n2. Do the other thing.";
    const result = enforceOutputContract(content, "plan");
    expect(result).toContain("Plan\n1.");
    expect(result).toContain("Risks / tradeoffs\n(no additional information)");
    expect(result).toContain("Next actions\n(no additional information)");
  });

  it("does not double-append headings already present", () => {
    const content = [
      "Observations",
      "The tests fail with exit code 1.",
      "",
      "Hypotheses",
      "1. Missing dependency.",
      "",
      "Recommendation",
      "Run npm install.",
    ].join("\n");
    const result = enforceOutputContract(content, "debug");
    expect(result).toBe(content);
  });

  it("appends Summary for agent mode if missing", () => {
    const content = "I fixed the bug by changing line 42.";
    const result = enforceOutputContract(content, "agent");
    expect(result).toContain("Summary\n(no additional information)");
  });

  it("handles headings with special regex chars (Risks / tradeoffs)", () => {
    const content = "Plan\nDo stuff.\n\nRisks / tradeoffs\nMight break.\n\nNext actions\nDeploy.";
    expect(enforceOutputContract(content, "plan")).toBe(content);
  });
});
