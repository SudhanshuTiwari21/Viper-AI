/**
 * @repo/browser-runner — E.26 browser automation facade.
 *
 * Usage is gated on the VIPER_BROWSER_TOOLS=1 env var. Callers should
 * check `isBrowserToolsEnabled()` before attempting to create sessions.
 *
 * Playwright is an optional peer dependency; if not installed, session
 * operations throw `BrowserRunnerError`.
 *
 * Local setup:
 *   npm install playwright
 *   npx playwright install chromium
 */

export { BrowserSession, createBrowserSession, BrowserRunnerError } from "./browser-session.js";
export type { NavigateResult, ScreenshotResult } from "./browser-session.js";
export { isUrlAllowed, parseAllowedOrigins, getAllowedOriginsFromEnv } from "./url-allowlist.js";
export {
  runRecipeSteps,
  parseRecipeSteps,
  validateRecipeStep,
  formatRecipeResult,
  assertPageText,
  getMaxRecipeSteps,
  getAssertTimeoutMs,
  getMaxSelectorLen,
  DEFAULT_MAX_RECIPE_STEPS,
  DEFAULT_ASSERT_TIMEOUT_MS,
  DEFAULT_MAX_SELECTOR_LEN,
} from "./validation-recipe.js";
export type {
  RecipeStep,
  NavigateStep,
  WaitForSelectorStep,
  AssertTextStep,
  ScreenshotStep,
  StepResult,
  RecipeResult,
  PlaywrightPageLike,
} from "./validation-recipe.js";

/**
 * Returns true when browser tools are explicitly enabled via env.
 * Default: false (safest option — existing deployments unchanged).
 */
export function isBrowserToolsEnabled(): boolean {
  const v = process.env["VIPER_BROWSER_TOOLS"];
  return v === "1" || v?.toLowerCase() === "true";
}

/** All browser tool names (E.26 + E.27). Exported for use in mode-tool-policy. */
export const BROWSER_TOOL_NAMES = [
  "browser_navigate",
  "browser_screenshot",
  "browser_assert_text",
  "browser_wait_for_selector",
  "browser_run_recipe",
] as const;

export type BrowserToolName = (typeof BROWSER_TOOL_NAMES)[number];
