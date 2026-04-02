/**
 * E.27 — Unit tests for validation-recipe.ts
 *
 * All tests run without a real Playwright browser; the BrowserSession
 * and page object are stubbed via private-field injection.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseRecipeSteps,
  validateRecipeStep,
  runRecipeSteps,
  formatRecipeResult,
  assertPageText,
  getMaxRecipeSteps,
  getAssertTimeoutMs,
  DEFAULT_MAX_RECIPE_STEPS,
  DEFAULT_ASSERT_TIMEOUT_MS,
  DEFAULT_MAX_SELECTOR_LEN,
  type RecipeStep,
} from "../validation-recipe.js";
import { BrowserSession } from "../browser-session.js";
import { BROWSER_TOOL_NAMES } from "../index.js";

// ---------------------------------------------------------------------------
// BROWSER_TOOL_NAMES — E.27 additions
// ---------------------------------------------------------------------------

describe("BROWSER_TOOL_NAMES (E.27)", () => {
  it("includes browser_assert_text", () => {
    expect(BROWSER_TOOL_NAMES).toContain("browser_assert_text");
  });
  it("includes browser_wait_for_selector", () => {
    expect(BROWSER_TOOL_NAMES).toContain("browser_wait_for_selector");
  });
  it("includes browser_run_recipe", () => {
    expect(BROWSER_TOOL_NAMES).toContain("browser_run_recipe");
  });
  it("still includes E.26 tools", () => {
    expect(BROWSER_TOOL_NAMES).toContain("browser_navigate");
    expect(BROWSER_TOOL_NAMES).toContain("browser_screenshot");
  });
});

// ---------------------------------------------------------------------------
// Environment constant helpers
// ---------------------------------------------------------------------------

describe("env constant helpers", () => {
  const ORIG_STEPS = process.env["VIPER_BROWSER_MAX_RECIPE_STEPS"];
  const ORIG_TIMEOUT = process.env["VIPER_BROWSER_ASSERT_TIMEOUT_MS"];

  afterEach(() => {
    if (ORIG_STEPS === undefined) delete process.env["VIPER_BROWSER_MAX_RECIPE_STEPS"];
    else process.env["VIPER_BROWSER_MAX_RECIPE_STEPS"] = ORIG_STEPS;
    if (ORIG_TIMEOUT === undefined) delete process.env["VIPER_BROWSER_ASSERT_TIMEOUT_MS"];
    else process.env["VIPER_BROWSER_ASSERT_TIMEOUT_MS"] = ORIG_TIMEOUT;
  });

  it("getMaxRecipeSteps returns default when unset", () => {
    delete process.env["VIPER_BROWSER_MAX_RECIPE_STEPS"];
    expect(getMaxRecipeSteps()).toBe(DEFAULT_MAX_RECIPE_STEPS);
  });

  it("getMaxRecipeSteps respects env override", () => {
    process.env["VIPER_BROWSER_MAX_RECIPE_STEPS"] = "5";
    expect(getMaxRecipeSteps()).toBe(5);
  });

  it("getAssertTimeoutMs returns default when unset", () => {
    delete process.env["VIPER_BROWSER_ASSERT_TIMEOUT_MS"];
    expect(getAssertTimeoutMs()).toBe(DEFAULT_ASSERT_TIMEOUT_MS);
  });

  it("getAssertTimeoutMs respects env override", () => {
    process.env["VIPER_BROWSER_ASSERT_TIMEOUT_MS"] = "3000";
    expect(getAssertTimeoutMs()).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// validateRecipeStep
// ---------------------------------------------------------------------------

describe("validateRecipeStep", () => {
  const maxSel = DEFAULT_MAX_SELECTOR_LEN;

  it("accepts a valid navigate step", () => {
    expect(validateRecipeStep({ type: "navigate", url: "http://localhost:3000" }, maxSel)).toBeNull();
  });

  it("rejects navigate with empty url", () => {
    expect(validateRecipeStep({ type: "navigate", url: "" }, maxSel)).toMatch(/url must be/);
  });

  it("accepts a valid wait_for_selector step", () => {
    expect(validateRecipeStep({ type: "wait_for_selector", selector: "#app" }, maxSel)).toBeNull();
  });

  it("rejects wait_for_selector with empty selector", () => {
    expect(validateRecipeStep({ type: "wait_for_selector", selector: "" }, maxSel)).toMatch(/selector must be/);
  });

  it("rejects wait_for_selector with selector exceeding max length", () => {
    const longSel = "a".repeat(maxSel + 1);
    expect(validateRecipeStep({ type: "wait_for_selector", selector: longSel }, maxSel)).toMatch(/exceeds max length/);
  });

  it("rejects wait_for_selector with non-positive timeoutMs", () => {
    expect(validateRecipeStep({ type: "wait_for_selector", selector: "#app", timeoutMs: -1 }, maxSel)).toMatch(/must be a positive finite/);
  });

  it("accepts a valid assert_text step (no selector)", () => {
    expect(validateRecipeStep({ type: "assert_text", substring: "Hello" }, maxSel)).toBeNull();
  });

  it("accepts a valid assert_text step with selector", () => {
    expect(validateRecipeStep({ type: "assert_text", substring: "Hello", selector: "h1" }, maxSel)).toBeNull();
  });

  it("rejects assert_text with empty substring", () => {
    expect(validateRecipeStep({ type: "assert_text", substring: "" }, maxSel)).toMatch(/substring must be/);
  });

  it("rejects assert_text with selector exceeding max length", () => {
    const longSel = "a".repeat(maxSel + 1);
    expect(validateRecipeStep({ type: "assert_text", substring: "hi", selector: longSel }, maxSel)).toMatch(/exceeds max length/);
  });

  it("accepts a screenshot step", () => {
    expect(validateRecipeStep({ type: "screenshot" }, maxSel)).toBeNull();
    expect(validateRecipeStep({ type: "screenshot", fullPage: true }, maxSel)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseRecipeSteps
// ---------------------------------------------------------------------------

describe("parseRecipeSteps", () => {
  it("rejects non-array input", () => {
    expect(parseRecipeSteps("not an array")).toMatchObject({ error: expect.stringMatching(/must be an array/) });
  });

  it("rejects empty array", () => {
    expect(parseRecipeSteps([])).toMatchObject({ error: expect.stringMatching(/empty/) });
  });

  it("rejects when step count exceeds max", () => {
    const steps = Array.from({ length: DEFAULT_MAX_RECIPE_STEPS + 1 }, () => ({
      type: "navigate",
      url: "http://localhost/",
    }));
    expect(parseRecipeSteps(steps)).toMatchObject({ error: expect.stringMatching(/Too many steps/) });
  });

  it("rejects a step with an unknown type", () => {
    const result = parseRecipeSteps([{ type: "unknown_step" }]);
    expect(result).toMatchObject({ error: expect.stringMatching(/type.*must be one of/) });
  });

  it("rejects a non-object step", () => {
    const result = parseRecipeSteps(["not an object"]);
    expect(result).toMatchObject({ error: expect.stringMatching(/must be an object/) });
  });

  it("returns parsed steps for a valid array", () => {
    const raw = [
      { type: "navigate", url: "http://localhost:3000" },
      { type: "assert_text", substring: "Hello" },
    ];
    const result = parseRecipeSteps(raw);
    expect("steps" in result).toBe(true);
    if ("steps" in result) {
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0]).toMatchObject({ type: "navigate" });
      expect(result.steps[1]).toMatchObject({ type: "assert_text" });
    }
  });

  it("propagates per-step validation errors", () => {
    const raw = [{ type: "navigate", url: "" }];
    expect(parseRecipeSteps(raw)).toMatchObject({ error: expect.stringMatching(/Step 0/) });
  });

  it("respects a custom maxSteps override", () => {
    const steps = [
      { type: "navigate", url: "http://localhost/" },
      { type: "navigate", url: "http://localhost/" },
    ];
    const result = parseRecipeSteps(steps, 1);
    expect(result).toMatchObject({ error: expect.stringMatching(/Too many steps/) });
  });
});

// ---------------------------------------------------------------------------
// assertPageText (mock page object)
// ---------------------------------------------------------------------------

describe("assertPageText", () => {
  it("returns found=true when substring is in page body", async () => {
    const mockPage = {
      innerText: vi.fn().mockResolvedValue("Welcome to Viper!"),
      waitForSelector: vi.fn(),
      textContent: vi.fn(),
    };
    const { found, detail } = await assertPageText(mockPage, "Viper", undefined, 5000);
    expect(found).toBe(true);
    expect(detail).toMatch(/found/);
    expect(mockPage.innerText).toHaveBeenCalledWith("body", expect.objectContaining({ timeout: 5000 }));
  });

  it("returns found=false when substring is absent", async () => {
    const mockPage = {
      innerText: vi.fn().mockResolvedValue("Different content"),
      waitForSelector: vi.fn(),
      textContent: vi.fn(),
    };
    const { found, detail } = await assertPageText(mockPage, "Viper", undefined, 5000);
    expect(found).toBe(false);
    expect(detail).toMatch(/NOT found/);
  });

  it("uses selector when provided", async () => {
    const mockPage = {
      innerText: vi.fn().mockResolvedValue("Login"),
      waitForSelector: vi.fn(),
      textContent: vi.fn(),
    };
    const { found } = await assertPageText(mockPage, "Login", "h1", 5000);
    expect(found).toBe(true);
    expect(mockPage.innerText).toHaveBeenCalledWith("h1", expect.any(Object));
  });

  it("returns found=false when innerText throws (e.g. selector not found)", async () => {
    const mockPage = {
      innerText: vi.fn().mockRejectedValue(new Error("Timeout")),
      waitForSelector: vi.fn(),
      textContent: vi.fn(),
    };
    const { found, detail } = await assertPageText(mockPage, "anything", ".missing", 5000);
    expect(found).toBe(false);
    expect(detail).toMatch(/assert_text error/);
  });
});

// ---------------------------------------------------------------------------
// runRecipeSteps — via mock BrowserSession
// ---------------------------------------------------------------------------

function makeMockSession(overrides?: {
  navigateFn?: () => Promise<{ url: string; title: string; statusCode: number | null }>;
  screenshotFn?: () => Promise<{ summary: string; base64: string; truncated: boolean; rawBytes: number }>;
  pageOverride?: object | null;
}): BrowserSession {
  const session = new BrowserSession();
  // @ts-expect-error — bypassing private for unit test
  session.browser = {};
  // @ts-expect-error
  session._closed = false;

  const defaultNavigate = vi.fn().mockResolvedValue({
    url: "http://localhost:3000/",
    title: "Test Page",
    statusCode: 200,
  });
  const defaultScreenshot = vi.fn().mockResolvedValue({
    summary: "Screenshot captured (100 bytes). Page: \"Test Page\" at http://localhost:3000/",
    base64: "abc123",
    truncated: false,
    rawBytes: 100,
  });

  const navigate = overrides?.navigateFn ?? defaultNavigate;
  const screenshot = overrides?.screenshotFn ?? defaultScreenshot;

  // Patch navigate and screenshot methods (public, no @ts-expect-error needed)
  session.navigate = navigate;
  session.screenshot = screenshot;

  const defaultPage = {
    innerText: vi.fn().mockResolvedValue("Hello World from the page"),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    textContent: vi.fn().mockResolvedValue("Hello World"),
  };

  // @ts-expect-error
  session.page = overrides?.pageOverride !== undefined ? overrides.pageOverride : defaultPage;

  return session;
}

describe("runRecipeSteps — navigate step", () => {
  it("succeeds on a valid navigate step", async () => {
    const session = makeMockSession();
    const steps: RecipeStep[] = [{ type: "navigate", url: "http://localhost:3000" }];
    const result = await runRecipeSteps(session, steps);
    expect(result.ok).toBe(true);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.type).toBe("navigate");
    expect(result.steps[0]!.ok).toBe(true);
  });

  it("stops and returns failure when navigate throws", async () => {
    const session = makeMockSession({
      navigateFn: vi.fn().mockRejectedValue(new Error("URL not allowed by policy: ...")),
    });
    const steps: RecipeStep[] = [
      { type: "navigate", url: "file:///etc/passwd" },
      { type: "assert_text", substring: "should not reach" },
    ];
    const result = await runRecipeSteps(session, steps);
    expect(result.ok).toBe(false);
    expect(result.steps).toHaveLength(1); // stopped after first failure
    expect(result.steps[0]!.ok).toBe(false);
    expect(result.steps[0]!.detail).toMatch(/Navigate failed/);
  });
});

describe("runRecipeSteps — wait_for_selector step", () => {
  it("passes when selector is visible", async () => {
    const session = makeMockSession();
    const steps: RecipeStep[] = [
      { type: "navigate", url: "http://localhost/" },
      { type: "wait_for_selector", selector: "#app" },
    ];
    const result = await runRecipeSteps(session, steps);
    expect(result.ok).toBe(true);
    expect(result.steps[1]!.type).toBe("wait_for_selector");
    expect(result.steps[1]!.ok).toBe(true);
  });

  it("fails and stops when selector is not found", async () => {
    const timedOutPage = {
      innerText: vi.fn(),
      waitForSelector: vi.fn().mockRejectedValue(new Error("Timeout waiting for selector")),
      textContent: vi.fn(),
    };
    const session = makeMockSession({ pageOverride: timedOutPage });
    const steps: RecipeStep[] = [
      { type: "navigate", url: "http://localhost/" },
      { type: "wait_for_selector", selector: ".missing-element", timeoutMs: 100 },
      { type: "assert_text", substring: "should not run" },
    ];
    const result = await runRecipeSteps(session, steps);
    expect(result.ok).toBe(false);
    expect(result.steps).toHaveLength(2); // stopped after wait_for_selector failure
    expect(result.steps[1]!.ok).toBe(false);
  });

  it("fires onAssertPass callback when selector visible", async () => {
    const onAssertPass = vi.fn();
    const session = makeMockSession();
    await runRecipeSteps(
      session,
      [{ type: "navigate", url: "http://localhost/" }, { type: "wait_for_selector", selector: "#app" }],
      { onAssertPass, onAssertFail: vi.fn() },
    );
    expect(onAssertPass).toHaveBeenCalledOnce();
    expect(onAssertPass).toHaveBeenCalledWith(1, "wait_for_selector", expect.stringMatching(/#app/));
  });

  it("fires onAssertFail callback when selector not found", async () => {
    const onAssertFail = vi.fn();
    const timedOutPage = {
      innerText: vi.fn(),
      waitForSelector: vi.fn().mockRejectedValue(new Error("Timeout")),
      textContent: vi.fn(),
    };
    const session = makeMockSession({ pageOverride: timedOutPage });
    await runRecipeSteps(
      session,
      [{ type: "navigate", url: "http://localhost/" }, { type: "wait_for_selector", selector: ".nope", timeoutMs: 100 }],
      { onAssertPass: vi.fn(), onAssertFail },
    );
    expect(onAssertFail).toHaveBeenCalledOnce();
  });

  it("returns error when no active page (missing navigate)", async () => {
    const session = makeMockSession({ pageOverride: null });
    const steps: RecipeStep[] = [{ type: "wait_for_selector", selector: "#app" }];
    const result = await runRecipeSteps(session, steps);
    expect(result.ok).toBe(false);
    expect(result.steps[0]!.detail).toMatch(/no active page/i);
  });
});

describe("runRecipeSteps — assert_text step", () => {
  it("passes when substring is present on the page", async () => {
    const session = makeMockSession();
    const steps: RecipeStep[] = [
      { type: "navigate", url: "http://localhost/" },
      { type: "assert_text", substring: "Hello World" },
    ];
    const result = await runRecipeSteps(session, steps);
    expect(result.ok).toBe(true);
    expect(result.steps[1]!.ok).toBe(true);
    expect(result.steps[1]!.detail).toMatch(/found/);
  });

  it("fails and stops when substring is absent", async () => {
    const session = makeMockSession();
    const steps: RecipeStep[] = [
      { type: "navigate", url: "http://localhost/" },
      { type: "assert_text", substring: "NOTPRESENT_XYZ" },
      { type: "screenshot" },
    ];
    const result = await runRecipeSteps(session, steps);
    expect(result.ok).toBe(false);
    expect(result.steps).toHaveLength(2); // stopped before screenshot
    expect(result.steps[1]!.ok).toBe(false);
  });

  it("fires assertion callbacks correctly", async () => {
    const onAssertPass = vi.fn();
    const onAssertFail = vi.fn();
    const session = makeMockSession();
    await runRecipeSteps(
      session,
      [
        { type: "navigate", url: "http://localhost/" },
        { type: "assert_text", substring: "Hello World" },
      ],
      { onAssertPass, onAssertFail },
    );
    expect(onAssertPass).toHaveBeenCalledOnce();
    expect(onAssertFail).not.toHaveBeenCalled();
  });

  it("returns error when no active page", async () => {
    const session = makeMockSession({ pageOverride: null });
    const result = await runRecipeSteps(session, [{ type: "assert_text", substring: "hi" }]);
    expect(result.ok).toBe(false);
    expect(result.steps[0]!.detail).toMatch(/no active page/i);
  });
});

describe("runRecipeSteps — screenshot step (non-fatal)", () => {
  it("screenshot failure does not stop the recipe", async () => {
    const session = makeMockSession({
      screenshotFn: vi.fn().mockRejectedValue(new Error("screenshot error")),
    });
    const steps: RecipeStep[] = [
      { type: "navigate", url: "http://localhost/" },
      { type: "screenshot" },
      { type: "assert_text", substring: "Hello World" },
    ];
    const result = await runRecipeSteps(session, steps);
    expect(result.ok).toBe(true); // screenshot failed but recipe still passed
    expect(result.steps).toHaveLength(3);
    expect(result.steps[1]!.ok).toBe(false); // screenshot step failed
    expect(result.steps[2]!.ok).toBe(true);  // assert_text continued
  });

  it("attaches base64 to screenshot step result", async () => {
    const session = makeMockSession();
    const steps: RecipeStep[] = [
      { type: "navigate", url: "http://localhost/" },
      { type: "screenshot" },
    ];
    const result = await runRecipeSteps(session, steps);
    expect(result.steps[1]!.screenshotBase64).toBe("abc123");
  });
});

describe("runRecipeSteps — multi-step ordering and stopping", () => {
  it("runs all steps in order when all pass", async () => {
    const session = makeMockSession();
    const steps: RecipeStep[] = [
      { type: "navigate", url: "http://localhost/" },
      { type: "wait_for_selector", selector: "#app" },
      { type: "assert_text", substring: "Hello World" },
      { type: "screenshot" },
    ];
    const result = await runRecipeSteps(session, steps);
    expect(result.ok).toBe(true);
    expect(result.steps).toHaveLength(4);
    result.steps.forEach((s, i) => {
      if (s.type !== "screenshot") expect(s.ok).toBe(true);
      expect(s.stepIndex).toBe(i);
    });
  });
});

// ---------------------------------------------------------------------------
// formatRecipeResult
// ---------------------------------------------------------------------------

describe("formatRecipeResult", () => {
  it("contains PASS for successful result", async () => {
    const session = makeMockSession();
    const result = await runRecipeSteps(session, [{ type: "navigate", url: "http://localhost/" }]);
    const formatted = formatRecipeResult(result);
    expect(formatted).toMatch(/^Recipe PASS/);
    expect(formatted).toMatch(/\[0\] ✓ NAVIGATE/);
  });

  it("contains FAIL for failed result", async () => {
    const session = makeMockSession({
      navigateFn: vi.fn().mockRejectedValue(new Error("Policy denied")),
    });
    const result = await runRecipeSteps(session, [{ type: "navigate", url: "file:///etc/passwd" }]);
    const formatted = formatRecipeResult(result);
    expect(formatted).toMatch(/^Recipe FAIL/);
    expect(formatted).toMatch(/\[0\] ✗ NAVIGATE/);
  });

  it("appends screenshot base64 when present", async () => {
    const session = makeMockSession();
    const result = await runRecipeSteps(session, [
      { type: "navigate", url: "http://localhost/" },
      { type: "screenshot" },
    ]);
    const formatted = formatRecipeResult(result);
    expect(formatted).toMatch(/Screenshot at step 1/);
    expect(formatted).toMatch(/abc123/);
  });
});
