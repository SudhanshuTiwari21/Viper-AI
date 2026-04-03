// G.41 — Eval harness unit tests.
// Tests fixture parsing, case dispatch, pass-rate math, and threshold logic.
// All pure / in-memory — no file system, no LLM.

import { describe, it, expect } from "vitest";
import { runSuite } from "./runner.js";
import type { EvalFixtureFile, EvalConfig } from "./types.js";

// ---------------------------------------------------------------------------
// runSuite (privacy-glob)
// ---------------------------------------------------------------------------

describe("runSuite — privacy-glob", () => {
  it("passes when all privacy cases pass", async () => {
    const fixture: EvalFixtureFile = {
      type: "privacy-glob",
      cases: [
        {
          id: "p1",
          description: "src/index.ts allowed",
          input: { relativePath: "src/index.ts" },
          expect: { allowed: true },
        },
        {
          id: "p2",
          description: ".env blocked",
          input: { relativePath: ".env" },
          expect: { allowed: false },
        },
      ],
    };

    const result = await runSuite(fixture, "privacy-glob.json");
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.passRate).toBe(1);
  });

  it("fails when expected allowed=false but path is actually allowed", async () => {
    const fixture: EvalFixtureFile = {
      type: "privacy-glob",
      cases: [
        {
          id: "p-wrong",
          description: "Wrong expectation: expects src/index.ts to be blocked",
          input: { relativePath: "src/index.ts" },
          expect: { allowed: false },
        },
      ],
    };

    const result = await runSuite(fixture, "privacy-glob.json");
    expect(result.failed).toBe(1);
    expect(result.passRate).toBe(0);
    expect(result.cases[0]?.status).toBe("fail");
  });

  it("blockedByPrefix check works", async () => {
    const fixture: EvalFixtureFile = {
      type: "privacy-glob",
      cases: [
        {
          id: "p-prefix",
          description: ".env blocked by builtin",
          input: { relativePath: ".env" },
          expect: { allowed: false, blockedByPrefix: "builtin:" },
        },
      ],
    };

    const result = await runSuite(fixture, "privacy-glob.json");
    expect(result.passed).toBe(1);
  });

  it("fails when blockedByPrefix does not match", async () => {
    const fixture: EvalFixtureFile = {
      type: "privacy-glob",
      cases: [
        {
          id: "p-prefix-wrong",
          description: "Wrong prefix: expects config: but builtin: fires",
          input: { relativePath: ".env" },
          expect: { allowed: false, blockedByPrefix: "config:" },
        },
      ],
    };

    const result = await runSuite(fixture, "privacy-glob.json");
    expect(result.failed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// runSuite — intent-scoring
// ---------------------------------------------------------------------------

describe("runSuite — intent-scoring", () => {
  it("passes for CODE_FIX tokens", async () => {
    const fixture: EvalFixtureFile = {
      type: "intent-scoring",
      cases: [
        {
          id: "i1",
          description: "fix bug tokens",
          input: { tokens: ["fix", "the", "bug"] },
          expect: { intentType: "CODE_FIX" },
        },
      ],
    };

    const result = await runSuite(fixture, "intent-scoring.json");
    expect(result.passed).toBe(1);
  });

  it("fails when wrong intentType expected", async () => {
    const fixture: EvalFixtureFile = {
      type: "intent-scoring",
      cases: [
        {
          id: "i-wrong",
          description: "expects wrong intentType",
          input: { tokens: ["fix", "bug"] },
          expect: { intentType: "REFACTOR" },
        },
      ],
    };

    const result = await runSuite(fixture, "intent-scoring.json");
    expect(result.failed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// runSuite — schema-validation
// ---------------------------------------------------------------------------

describe("runSuite — schema-validation", () => {
  it("ChatMode 'ask' valid → pass", async () => {
    const fixture: EvalFixtureFile = {
      type: "schema-validation",
      cases: [
        {
          id: "s1",
          description: "ask is valid",
          input: { schema: "ChatMode", value: "ask" },
          expect: { valid: true },
        },
      ],
    };

    const result = await runSuite(fixture, "schema-validation.json");
    expect(result.passed).toBe(1);
  });

  it("ChatMode 'garbage' invalid → pass", async () => {
    const fixture: EvalFixtureFile = {
      type: "schema-validation",
      cases: [
        {
          id: "s2",
          description: "garbage is invalid",
          input: { schema: "ChatMode", value: "garbage" },
          expect: { valid: false },
        },
      ],
    };

    const result = await runSuite(fixture, "schema-validation.json");
    expect(result.passed).toBe(1);
  });

  it("unknown schema name → error result", async () => {
    const fixture: EvalFixtureFile = {
      type: "schema-validation",
      cases: [
        {
          id: "s-unknown",
          description: "unknown schema",
          input: { schema: "NonExistentSchema" as "ChatMode", value: "x" },
          expect: { valid: true },
        },
      ],
    };

    const result = await runSuite(fixture, "schema-validation.json");
    expect(result.errors).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// runSuite — workflow-stage
// ---------------------------------------------------------------------------

describe("runSuite — workflow-stage", () => {
  it("present=true for known stage", async () => {
    const fixture: EvalFixtureFile = {
      type: "workflow-stage",
      cases: [
        {
          id: "wf1",
          description: "privacy:path:blocked must be present",
          input: { stage: "privacy:path:blocked" },
          expect: { present: true },
        },
      ],
    };

    const result = await runSuite(fixture, "workflow-stages.json");
    expect(result.passed).toBe(1);
  });

  it("present=false for unknown stage", async () => {
    const fixture: EvalFixtureFile = {
      type: "workflow-stage",
      cases: [
        {
          id: "wf2",
          description: "fake stage not present",
          input: { stage: "fake:stage:xyz" },
          expect: { present: false },
        },
      ],
    };

    const result = await runSuite(fixture, "workflow-stages.json");
    expect(result.passed).toBe(1);
  });

  it("fails when expected present=true but stage missing", async () => {
    const fixture: EvalFixtureFile = {
      type: "workflow-stage",
      cases: [
        {
          id: "wf-missing",
          description: "expects a missing stage to be present",
          input: { stage: "totally:invented:stage" },
          expect: { present: true },
        },
      ],
    };

    const result = await runSuite(fixture, "workflow-stages.json");
    expect(result.failed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Pass-rate math
// ---------------------------------------------------------------------------

describe("pass-rate math", () => {
  it("passRate = 0.5 when half pass", async () => {
    const fixture: EvalFixtureFile = {
      type: "privacy-glob",
      cases: [
        {
          id: "x1",
          description: "allowed pass",
          input: { relativePath: "src/index.ts" },
          expect: { allowed: true },
        },
        {
          id: "x2",
          description: "wrong expect fails",
          input: { relativePath: "src/index.ts" },
          expect: { allowed: false },
        },
      ],
    };

    const result = await runSuite(fixture, "test.json");
    expect(result.passRate).toBeCloseTo(0.5);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("passRate = 1 for empty case list", async () => {
    const fixture: EvalFixtureFile = { type: "privacy-glob", cases: [] };
    const result = await runSuite(fixture, "empty.json");
    expect(result.passRate).toBe(1);
    expect(result.passed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Threshold logic
// ---------------------------------------------------------------------------

describe("threshold logic", () => {
  it("thresholdPassed=true when all pass", () => {
    const config: EvalConfig = {
      tiers: { offline: { required_pass_rate: 1.0 } },
    };
    const overallPassRate = 1.0;
    expect(overallPassRate >= config.tiers.offline.required_pass_rate).toBe(true);
  });

  it("thresholdPassed=false when one fails with 100% required", () => {
    const config: EvalConfig = {
      tiers: { offline: { required_pass_rate: 1.0 } },
    };
    const overallPassRate = 0.95;
    expect(overallPassRate >= config.tiers.offline.required_pass_rate).toBe(false);
  });

  it("thresholdPassed=true at exactly threshold", () => {
    const config: EvalConfig = {
      tiers: { offline: { required_pass_rate: 0.9 } },
    };
    const overallPassRate = 0.9;
    expect(overallPassRate >= config.tiers.offline.required_pass_rate).toBe(true);
  });
});
