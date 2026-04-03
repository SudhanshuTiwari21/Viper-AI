#!/usr/bin/env node
// G.41 — Eval harness CLI entry point.
//
// Usage:
//   npx tsx src/run.ts                        # run offline tier from default fixtures dir
//   npx tsx src/run.ts --fixtures ./fixtures  # explicit fixtures dir
//   npx tsx src/run.ts --output eval-results.json
//
// Exit codes:
//   0  — all required cases passed (pass rate >= threshold)
//   1  — one or more required cases failed, or pass rate below threshold

import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runHarness, loadEvalConfig } from "./runner.js";
import type { SuiteResult, CaseResult } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

const PASS = "\u001B[32mPASS\u001B[0m";
const FAIL = "\u001B[31mFAIL\u001B[0m";
const ERROR = "\u001B[33mERROR\u001B[0m";
const SKIP = "\u001B[90mSKIP\u001B[0m";

function statusIcon(status: CaseResult["status"]): string {
  switch (status) {
    case "pass": return PASS;
    case "fail": return FAIL;
    case "error": return ERROR;
    case "skip": return SKIP;
  }
}

function printSuite(suite: SuiteResult): void {
  const icon = suite.failed > 0 || suite.errors > 0 ? "✗" : "✓";
  console.log(`\n${icon} [${suite.type}] ${suite.file}  (${suite.durationMs}ms)`);
  for (const c of suite.cases) {
    const tag = statusIcon(c.status);
    console.log(`  ${tag}  ${c.id.padEnd(40)} ${c.description}`);
    if (c.error) {
      console.log(`         └─ ${c.error}`);
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fixturesDirArg = args[args.indexOf("--fixtures") + 1];
  const outputArg = args[args.indexOf("--output") + 1];

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const harnessRoot = resolve(__dirname, "..");
  const fixturesDir = fixturesDirArg
    ? resolve(fixturesDirArg)
    : resolve(harnessRoot, "fixtures");
  const outputPath = outputArg ? resolve(outputArg) : null;

  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│  ViperAI Eval Harness — G.41 offline tier               │");
  console.log("└─────────────────────────────────────────────────────────┘");
  console.log(`Fixtures: ${fixturesDir}`);

  const config = await loadEvalConfig(harnessRoot);
  const result = await runHarness(fixturesDir, config);

  for (const suite of result.suites) {
    printSuite(suite);
  }

  console.log("\n──────────────────────────────────────────────────────────");
  console.log(`Cases:      ${result.totalPassed} passed, ${result.totalFailed} failed, ${result.totalSkipped} skipped`);
  console.log(`Pass rate:  ${percent(result.overallPassRate)}  (threshold: ${percent(config.tiers.offline.required_pass_rate)})`);
  console.log(`Duration:   ${result.durationMs}ms`);
  console.log(`Result:     ${result.thresholdPassed ? "\u001B[32mPASSED\u001B[0m" : "\u001B[31mFAILED\u001B[0m"}`);
  console.log("──────────────────────────────────────────────────────────\n");

  if (outputPath) {
    await writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`JSON summary written to ${outputPath}`);
  }

  process.exit(result.thresholdPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Eval harness crashed:", err);
  process.exit(1);
});
