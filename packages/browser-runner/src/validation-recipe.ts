/**
 * E.27 — Validation recipe library.
 *
 * Composable, typed recipe steps that run on top of a BrowserSession.
 * Each step is a discriminated union member; `runRecipeSteps` executes
 * them in order and returns a structured result per step.
 *
 * Resource limits (env overrides):
 *   VIPER_BROWSER_MAX_RECIPE_STEPS  — max steps per recipe run  (default 20)
 *   VIPER_BROWSER_ASSERT_TIMEOUT_MS — waitForSelector / assert timeout (default 5 s)
 *   VIPER_BROWSER_MAX_SELECTOR_LEN  — max CSS selector string length (default 512)
 */

import type { BrowserSession } from "./browser-session.js";
import { BrowserRunnerError } from "./browser-session.js";
import { envInt } from "./env-helpers.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_MAX_RECIPE_STEPS = 20;
export const DEFAULT_ASSERT_TIMEOUT_MS = 5_000;
export const DEFAULT_MAX_SELECTOR_LEN = 512;

export function getMaxRecipeSteps(): number {
  return envInt("VIPER_BROWSER_MAX_RECIPE_STEPS", DEFAULT_MAX_RECIPE_STEPS);
}
export function getAssertTimeoutMs(): number {
  return envInt("VIPER_BROWSER_ASSERT_TIMEOUT_MS", DEFAULT_ASSERT_TIMEOUT_MS);
}
export function getMaxSelectorLen(): number {
  return envInt("VIPER_BROWSER_MAX_SELECTOR_LEN", DEFAULT_MAX_SELECTOR_LEN);
}

// ---------------------------------------------------------------------------
// Step types (discriminated union)
// ---------------------------------------------------------------------------

/** Navigate to a URL. Subject to the same URL allowlist as browser_navigate. */
export interface NavigateStep {
  type: "navigate";
  url: string;
}

/**
 * Wait until a CSS selector is visible in the DOM.
 * Times out after `timeoutMs` (default VIPER_BROWSER_ASSERT_TIMEOUT_MS).
 */
export interface WaitForSelectorStep {
  type: "wait_for_selector";
  selector: string;
  timeoutMs?: number;
}

/**
 * Assert that a substring is present in the page text or within a selector.
 * Fails if the text is not found (case-sensitive by default).
 */
export interface AssertTextStep {
  type: "assert_text";
  substring: string;
  /** Optional CSS selector to scope the text search. Searches whole page when omitted. */
  selector?: string;
}

/** Take a screenshot at this point in the recipe. */
export interface ScreenshotStep {
  type: "screenshot";
  fullPage?: boolean;
}

export type RecipeStep =
  | NavigateStep
  | WaitForSelectorStep
  | AssertTextStep
  | ScreenshotStep;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface StepResult {
  stepIndex: number;
  type: RecipeStep["type"];
  ok: boolean;
  /** Short human-readable summary for the model. */
  detail: string;
  /** For screenshot steps: base64-encoded PNG (may be truncated). */
  screenshotBase64?: string;
}

export interface RecipeResult {
  ok: boolean;
  steps: StepResult[];
  /** Concise multi-line summary for the model: one line per step. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate a recipe step before execution.
 * Returns an error message string on failure, or null when valid.
 */
export function validateRecipeStep(step: RecipeStep, maxSelectorLen: number): string | null {
  switch (step.type) {
    case "navigate":
      if (!step.url?.trim()) return "navigate step: url must be a non-empty string.";
      return null;

    case "wait_for_selector":
      if (!step.selector?.trim()) return "wait_for_selector step: selector must be non-empty.";
      if (step.selector.length > maxSelectorLen) {
        return `wait_for_selector step: selector exceeds max length of ${maxSelectorLen} chars.`;
      }
      if (step.timeoutMs !== undefined && (step.timeoutMs <= 0 || !Number.isFinite(step.timeoutMs))) {
        return "wait_for_selector step: timeoutMs must be a positive finite number.";
      }
      return null;

    case "assert_text":
      if (!step.substring?.trim()) return "assert_text step: substring must be non-empty.";
      if (step.selector !== undefined && step.selector.length > maxSelectorLen) {
        return `assert_text step: selector exceeds max length of ${maxSelectorLen} chars.`;
      }
      return null;

    case "screenshot":
      return null; // no required fields

    default: {
      const _exhaustive: never = step;
      return `Unknown step type: ${(_exhaustive as RecipeStep).type}`;
    }
  }
}

/**
 * Validate and normalise a raw (unknown) array into typed RecipeStep[].
 * Returns { steps } on success or { error } on failure.
 */
export function parseRecipeSteps(
  raw: unknown,
  maxSteps?: number,
): { steps: RecipeStep[] } | { error: string } {
  const limit = maxSteps ?? getMaxRecipeSteps();

  if (!Array.isArray(raw)) return { error: "steps must be an array." };
  if (raw.length === 0) return { error: "steps array is empty." };
  if (raw.length > limit) {
    return { error: `Too many steps (${raw.length}). Maximum allowed: ${limit}.` };
  }

  const VALID_TYPES = new Set(["navigate", "wait_for_selector", "assert_text", "screenshot"]);
  const maxSel = getMaxSelectorLen();

  const steps: RecipeStep[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (typeof item !== "object" || item === null) {
      return { error: `Step ${i}: must be an object.` };
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj["type"] !== "string" || !VALID_TYPES.has(obj["type"])) {
      return {
        error: `Step ${i}: "type" must be one of ${[...VALID_TYPES].join(", ")}. Got: "${obj["type"]}"`,
      };
    }
    const step = obj as unknown as RecipeStep;
    const err = validateRecipeStep(step, maxSel);
    if (err) return { error: `Step ${i}: ${err}` };
    steps.push(step);
  }
  return { steps };
}

// ---------------------------------------------------------------------------
// Page-level helpers (accept Playwright page via duck typing)
// ---------------------------------------------------------------------------

/** Minimal interface so we can test without real Playwright. */
export interface PlaywrightPageLike {
  innerText(selector: string, options?: { timeout?: number }): Promise<string>;
  waitForSelector(selector: string, options?: { timeout?: number; state?: string }): Promise<unknown>;
  textContent(selector?: string, options?: { timeout?: number }): Promise<string | null>;
}

/**
 * Assert that `substring` appears in the text of a page (or within a selector).
 * Returns null on success, or an error message on failure.
 */
export async function assertPageText(
  page: PlaywrightPageLike,
  substring: string,
  selector: string | undefined,
  timeoutMs: number,
): Promise<{ found: boolean; detail: string }> {
  try {
    let text: string;
    if (selector) {
      text = await page.innerText(selector, { timeout: timeoutMs });
    } else {
      text = (await page.innerText("body", { timeout: timeoutMs })) ?? "";
    }
    const found = text.includes(substring);
    return {
      found,
      detail: found
        ? `Text "${substring}" found${selector ? ` within "${selector}"` : " on page"}.`
        : `Text "${substring}" NOT found${selector ? ` within "${selector}"` : " on page"}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { found: false, detail: `assert_text error: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// runRecipeSteps — main entry point
// ---------------------------------------------------------------------------

/**
 * Run an ordered list of recipe steps against a live BrowserSession.
 *
 * Execution stops on the first failing step (navigate error, assertion
 * failure, or wait timeout). A screenshot step never stops the sequence.
 *
 * The caller is responsible for calling `session.open()` before this
 * function and `session.close()` after.
 *
 * @param session  An already-opened BrowserSession.
 * @param steps    Validated recipe steps (use `parseRecipeSteps` first).
 * @param callbacks  Optional hooks for workflow logging.
 */
export async function runRecipeSteps(
  session: BrowserSession,
  steps: RecipeStep[],
  callbacks?: {
    onAssertPass?: (stepIndex: number, kind: string, detail: string) => void;
    onAssertFail?: (stepIndex: number, kind: string, detail: string) => void;
  },
): Promise<RecipeResult> {
  const stepResults: StepResult[] = [];
  const assertTimeout = getAssertTimeoutMs();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;

    switch (step.type) {
      case "navigate": {
        try {
          const r = await session.navigate(step.url);
          const detail = `Navigated to ${r.url} — "${r.title}"${r.statusCode !== null ? ` (HTTP ${r.statusCode})` : ""}`;
          stepResults.push({ stepIndex: i, type: "navigate", ok: true, detail });
        } catch (err) {
          const detail = `Navigate failed: ${err instanceof Error ? err.message : String(err)}`;
          stepResults.push({ stepIndex: i, type: "navigate", ok: false, detail });
          return makeResult(false, stepResults);
        }
        break;
      }

      case "wait_for_selector": {
        // Access the page via the session's internal page — we use
        // the session's screenshot method as a proxy to verify the page
        // is available, then call the Playwright page directly.
        // To avoid coupling to Playwright internals we call the session's
        // public API: we use a small duck-type cast.
        const pw = session as unknown as { page: PlaywrightPageLike | null };
        const page = pw.page;
        if (!page) {
          const detail = "wait_for_selector: no active page. Call browser_navigate first.";
          stepResults.push({ stepIndex: i, type: "wait_for_selector", ok: false, detail });
          return makeResult(false, stepResults);
        }
        const timeout = step.timeoutMs ?? assertTimeout;
        try {
          await page.waitForSelector(step.selector, { timeout, state: "visible" });
          const detail = `Selector "${step.selector}" is visible.`;
          stepResults.push({ stepIndex: i, type: "wait_for_selector", ok: true, detail });
          callbacks?.onAssertPass?.(i, "wait_for_selector", detail);
        } catch (err) {
          const detail = `Selector "${step.selector}" not found within ${timeout}ms: ${err instanceof Error ? err.message : String(err)}`;
          stepResults.push({ stepIndex: i, type: "wait_for_selector", ok: false, detail });
          callbacks?.onAssertFail?.(i, "wait_for_selector", detail);
          return makeResult(false, stepResults);
        }
        break;
      }

      case "assert_text": {
        const pw = session as unknown as { page: PlaywrightPageLike | null };
        const page = pw.page;
        if (!page) {
          const detail = "assert_text: no active page. Call browser_navigate first.";
          stepResults.push({ stepIndex: i, type: "assert_text", ok: false, detail });
          return makeResult(false, stepResults);
        }
        const { found, detail } = await assertPageText(
          page,
          step.substring,
          step.selector,
          assertTimeout,
        );
        stepResults.push({ stepIndex: i, type: "assert_text", ok: found, detail });
        if (found) {
          callbacks?.onAssertPass?.(i, "assert_text", detail);
        } else {
          callbacks?.onAssertFail?.(i, "assert_text", detail);
          return makeResult(false, stepResults);
        }
        break;
      }

      case "screenshot": {
        try {
          const r = await session.screenshot({ fullPage: step.fullPage ?? false });
          const detail = r.summary;
          stepResults.push({
            stepIndex: i,
            type: "screenshot",
            ok: true,
            detail,
            screenshotBase64: r.base64,
          });
        } catch (err) {
          const detail = `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`;
          stepResults.push({ stepIndex: i, type: "screenshot", ok: false, detail });
          // screenshot failure is non-fatal — continue
        }
        break;
      }
    }
  }

  return makeResult(true, stepResults);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeResult(ok: boolean, steps: StepResult[]): RecipeResult {
  const lines = steps.map((s) => {
    const icon = s.ok ? "✓" : "✗";
    const label = s.type.toUpperCase().replace(/_/g, " ");
    return `[${s.stepIndex}] ${icon} ${label}: ${s.detail}`;
  });
  const summary = lines.join("\n");
  return { ok, steps, summary };
}

/**
 * Build a short text representation of a RecipeResult suitable for
 * returning to the model as tool output.
 */
export function formatRecipeResult(result: RecipeResult): string {
  const status = result.ok ? "PASS" : "FAIL";
  const parts: string[] = [`Recipe ${status} (${result.steps.length} steps)\n${result.summary}`];

  // Append any screenshots at the end so the model can inspect them
  for (const s of result.steps) {
    if (s.type === "screenshot" && s.screenshotBase64) {
      parts.push(`\nScreenshot at step ${s.stepIndex} (base64 PNG):\n${s.screenshotBase64}`);
    }
  }

  return parts.join("\n");
}
