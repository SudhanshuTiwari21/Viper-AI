// G.41 — Eval harness core runner.
// Loads fixture files, dispatches each case to the appropriate runner,
// collects results, and computes pass rates against thresholds.

import { readFile, readdir } from "node:fs/promises";
import { resolve, join, basename } from "node:path";

import type {
  EvalCase,
  EvalFixtureFile,
  EvalConfig,
  CaseResult,
  SuiteResult,
  HarnessResult,
  CaseType,
  PrivacyGlobInput,
  PrivacyGlobExpect,
  IntentScoringInput,
  IntentScoringExpect,
  SchemaValidationInput,
  SchemaValidationExpect,
  WorkflowStageInput,
  WorkflowStageExpect,
} from "./types.js";
import { runPrivacyGlobCase } from "./runners/privacy-glob.runner.js";
import { runIntentScoringCase } from "./runners/intent-scoring.runner.js";
import { runSchemaValidationCase } from "./runners/schema-validation.runner.js";
import { runWorkflowStageCase } from "./runners/workflow-stage.runner.js";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

export async function loadFixtures(fixturesDir: string): Promise<EvalFixtureFile[]> {
  let files: string[];
  try {
    const entries = await readdir(fixturesDir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }

  const fixtures: EvalFixtureFile[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(join(fixturesDir, file), "utf-8");
      const parsed = JSON.parse(raw) as EvalFixtureFile;
      fixtures.push(parsed);
    } catch (err) {
      console.error(`[eval] Failed to parse fixture ${file}: ${err}`);
    }
  }
  return fixtures;
}

export async function loadEvalConfig(harnessRoot: string): Promise<EvalConfig> {
  try {
    const raw = await readFile(resolve(harnessRoot, "eval.config.json"), "utf-8");
    return JSON.parse(raw) as EvalConfig;
  } catch {
    return {
      tiers: {
        offline: { required_pass_rate: 1.0 },
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function runCase(type: CaseType, c: EvalCase): Promise<CaseResult> {
  switch (type) {
    case "privacy-glob":
      return runPrivacyGlobCase(c as EvalCase<PrivacyGlobInput, PrivacyGlobExpect>);
    case "intent-scoring":
      return runIntentScoringCase(c as EvalCase<IntentScoringInput, IntentScoringExpect>);
    case "schema-validation":
      return runSchemaValidationCase(c as EvalCase<SchemaValidationInput, SchemaValidationExpect>);
    case "workflow-stage":
      return runWorkflowStageCase(c as EvalCase<WorkflowStageInput, WorkflowStageExpect>);
    default: {
      const _exhaustive: never = type;
      return {
        id: (c as EvalCase).id,
        description: (c as EvalCase).description,
        status: "error",
        durationMs: 0,
        error: `Unknown case type: ${_exhaustive as string}`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Suite runner
// ---------------------------------------------------------------------------

export async function runSuite(
  fixture: EvalFixtureFile,
  fileName: string,
): Promise<SuiteResult> {
  const suiteStart = Date.now();
  const results: CaseResult[] = [];

  for (const c of fixture.cases) {
    const result = await runCase(fixture.type, c);
    results.push(result);
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const errors = results.filter((r) => r.status === "error").length;
  const total = results.length;
  const passRate = total > 0 ? passed / total : 1;

  return {
    file: basename(fileName),
    type: fixture.type,
    cases: results,
    passed,
    failed,
    skipped,
    errors,
    passRate,
    durationMs: Date.now() - suiteStart,
  };
}

// ---------------------------------------------------------------------------
// Harness runner
// ---------------------------------------------------------------------------

export async function runHarness(
  fixturesDir: string,
  config: EvalConfig,
): Promise<HarnessResult> {
  const harnessStart = Date.now();
  const fixtures = await loadFixtures(fixturesDir);
  const suites: SuiteResult[] = [];

  for (const fixture of fixtures) {
    const suite = await runSuite(fixture, fixture.type);
    suites.push(suite);
  }

  const totalCases = suites.reduce((s, r) => s + r.cases.length, 0);
  const totalPassed = suites.reduce((s, r) => s + r.passed, 0);
  const totalFailed = suites.reduce((s, r) => s + r.failed, 0);
  const totalSkipped = suites.reduce((s, r) => s + r.skipped, 0);
  const overallPassRate = totalCases > 0 ? totalPassed / totalCases : 1;

  const required = config.tiers.offline.required_pass_rate;
  const thresholdPassed = overallPassRate >= required;

  return {
    suites,
    totalCases,
    totalPassed,
    totalFailed,
    totalSkipped,
    overallPassRate,
    durationMs: Date.now() - harnessStart,
    thresholdPassed,
  };
}
