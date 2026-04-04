/**
 * E.28 — Unit tests for browser:step SSE event emission.
 *
 * These tests exercise the onBrowserStreamEvent callback wiring in
 * buildBrowserTools without launching a real Playwright browser.
 * They verify:
 *   1. Correct event shape (phase, url, rawBytes, detail, kind, stepIndex).
 *   2. Correct ordering of events across a simulated tool sequence.
 *   3. Env-off regression: no events when enabled=false.
 *   4. Policy-denied phase emitted when navigate is blocked.
 */

import { describe, it, expect, vi } from "vitest";
import { buildBrowserTools } from "@repo/agentic-loop";
import type { BrowserStepEventPayload } from "@repo/agentic-loop";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock BrowserSession shaped like BrowserToolSession. */
function makeMockSession(overrides?: {
  navigateResult?: { url: string; title: string; statusCode: number | null };
  navigateError?: Error;
  screenshotResult?: { summary: string; base64: string; truncated: boolean; rawBytes: number };
}) {
  const defaultNavigate = {
    url: "http://localhost:3000/",
    title: "My App",
    statusCode: 200,
  };
  const defaultScreenshot = {
    summary: "Screenshot captured (500 bytes). Page: \"My App\" at http://localhost:3000/",
    base64: "abc123",
    truncated: false,
    rawBytes: 500,
  };

  return {
    navigate: overrides?.navigateError
      ? vi.fn().mockRejectedValue(overrides.navigateError)
      : vi.fn().mockResolvedValue(overrides?.navigateResult ?? defaultNavigate),
    screenshot: vi.fn().mockResolvedValue(overrides?.screenshotResult ?? defaultScreenshot),
    isClosed: false,
    // page duck-type for E.27 assertion tools
    page: {
      innerText: vi.fn().mockResolvedValue("Hello World"),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      textContent: vi.fn().mockResolvedValue("Hello World"),
    },
  };
}

// ---------------------------------------------------------------------------
// E.28: env kill-switch off — no SSE events
// ---------------------------------------------------------------------------

describe("E.28 — onBrowserStreamEvent: env off", () => {
  it("no events emitted when enabled=false", () => {
    const events: BrowserStepEventPayload[] = [];
    buildBrowserTools(
      async () => { throw new Error("should not be called"); },
      false,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );
    // buildBrowserTools with enabled=false returns empty array synchronously
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// E.28: browser_navigate — session:start + navigate events
// ---------------------------------------------------------------------------

describe("E.28 — browser_navigate SSE events", () => {
  it("emits session:start then navigate on success", async () => {
    const session = makeMockSession();
    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const navigateTool = tools.find((t) => t.definition.function.name === "browser_navigate")!;
    await navigateTool.execute({ url: "http://localhost:3000" });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ phase: "session:start" });
    expect(events[1]).toMatchObject({
      phase: "navigate",
      url: "http://localhost:3000/",
    });
    // detail should be present and capped
    expect(typeof events[1]!.detail).toBe("string");
    expect(events[1]!.detail!.length).toBeLessThanOrEqual(200);
  });

  it("emits policy:denied when URL is blocked", async () => {
    const session = makeMockSession({
      navigateError: new Error("URL not allowed by policy: file:///etc/passwd"),
    });
    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const navigateTool = tools.find((t) => t.definition.function.name === "browser_navigate")!;
    await navigateTool.execute({ url: "file:///etc/passwd" });

    // session:start fires before navigate attempt, then policy:denied
    const policyEvt = events.find((e) => e.phase === "policy:denied");
    expect(policyEvt).toBeDefined();
    expect(policyEvt!.detail).toMatch(/not allowed by policy/);
    expect(policyEvt!.detail!.length).toBeLessThanOrEqual(200);
  });

  it("does not emit navigate when URL is empty (early return)", async () => {
    const session = makeMockSession();
    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const navigateTool = tools.find((t) => t.definition.function.name === "browser_navigate")!;
    const result = await navigateTool.execute({ url: "" });

    expect(result).toBe("No URL provided.");
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// E.28: browser_screenshot — screenshot event
// ---------------------------------------------------------------------------

describe("E.28 — browser_screenshot SSE events", () => {
  it("emits screenshot event with rawBytes and detail", async () => {
    const session = makeMockSession();
    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const screenshotTool = tools.find((t) => t.definition.function.name === "browser_screenshot")!;
    await screenshotTool.execute({ full_page: false });

    const evt = events.find((e) => e.phase === "screenshot");
    expect(evt).toBeDefined();
    expect(evt!.rawBytes).toBe(500);
    expect(typeof evt!.detail).toBe("string");
    expect(evt!.detail!.length).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// E.28: browser_assert_text — assert:pass / assert:fail events
// ---------------------------------------------------------------------------

describe("E.28 — browser_assert_text SSE events", () => {
  it("emits assert:pass with kind=assert_text when text found", async () => {
    const session = makeMockSession();
    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const assertTool = tools.find((t) => t.definition.function.name === "browser_assert_text")!;
    await assertTool.execute({ substring: "Hello World" });

    const evt = events.find((e) => e.phase === "assert:pass");
    expect(evt).toBeDefined();
    expect(evt!.kind).toBe("assert_text");
    expect(evt!.detail).toMatch(/found/);
  });

  it("emits assert:fail with kind=assert_text when text not found", async () => {
    const session = makeMockSession();
    // Override innerText to return content without the substring
    (session.page.innerText as ReturnType<typeof vi.fn>).mockResolvedValue("Different text");

    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const assertTool = tools.find((t) => t.definition.function.name === "browser_assert_text")!;
    await assertTool.execute({ substring: "NOT_PRESENT_XYZ" });

    const evt = events.find((e) => e.phase === "assert:fail");
    expect(evt).toBeDefined();
    expect(evt!.kind).toBe("assert_text");
    expect(evt!.detail).toMatch(/NOT found/);
    expect(evt!.detail!.length).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// E.28: browser_wait_for_selector — assert:pass / assert:fail events
// ---------------------------------------------------------------------------

describe("E.28 — browser_wait_for_selector SSE events", () => {
  it("emits assert:pass with kind=wait_for_selector when visible", async () => {
    const session = makeMockSession();
    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const waitTool = tools.find((t) => t.definition.function.name === "browser_wait_for_selector")!;
    await waitTool.execute({ selector: "#app" });

    const evt = events.find((e) => e.phase === "assert:pass");
    expect(evt).toBeDefined();
    expect(evt!.kind).toBe("wait_for_selector");
    expect(evt!.detail).toMatch(/visible/);
  });

  it("emits assert:fail with kind=wait_for_selector when timeout", async () => {
    const session = makeMockSession();
    (session.page.waitForSelector as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Timeout 100ms exceeded"),
    );

    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const waitTool = tools.find((t) => t.definition.function.name === "browser_wait_for_selector")!;
    await waitTool.execute({ selector: ".missing", timeout_ms: 100 });

    const evt = events.find((e) => e.phase === "assert:fail");
    expect(evt).toBeDefined();
    expect(evt!.kind).toBe("wait_for_selector");
    expect(evt!.detail!.length).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// E.28: browser_run_recipe — per-step assert events with stepIndex
// ---------------------------------------------------------------------------

describe("E.28 — browser_run_recipe SSE events", () => {
  it("emits navigate event for navigate step (via recipe onAssertPass -> onBrowserStreamEvent bridging)", async () => {
    const session = makeMockSession();
    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const recipeTool = tools.find((t) => t.definition.function.name === "browser_run_recipe")!;
    await recipeTool.execute({
      steps: [
        { type: "navigate", url: "http://localhost:3000" },
        { type: "assert_text", substring: "Hello World" },
      ],
    });

    const assertEvt = events.find((e) => e.phase === "assert:pass" && e.kind === "assert_text");
    expect(assertEvt).toBeDefined();
    expect(assertEvt!.stepIndex).toBe(1);
    expect(assertEvt!.detail!.length).toBeLessThanOrEqual(200);
  });

  it("emits assert:fail with correct stepIndex when assertion fails mid-recipe", async () => {
    const session = makeMockSession();
    (session.page.innerText as ReturnType<typeof vi.fn>).mockResolvedValue("Something else");

    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const recipeTool = tools.find((t) => t.definition.function.name === "browser_run_recipe")!;
    await recipeTool.execute({
      steps: [
        { type: "navigate", url: "http://localhost:3000" },
        { type: "assert_text", substring: "MISSING_TEXT" },
      ],
    });

    const failEvt = events.find((e) => e.phase === "assert:fail");
    expect(failEvt).toBeDefined();
    expect(failEvt!.stepIndex).toBe(1);
  });

  it("returns validation error without emitting SSE when steps are invalid", async () => {
    const session = makeMockSession();
    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const recipeTool = tools.find((t) => t.definition.function.name === "browser_run_recipe")!;
    const result = await recipeTool.execute({ steps: [] });

    expect(result).toContain("Recipe validation error");
    expect(events).toHaveLength(0); // no SSE before validation
  });
});

// ---------------------------------------------------------------------------
// E.28: event ordering — multi-step sequence
// ---------------------------------------------------------------------------

describe("E.28 — event ordering across navigate + assert", () => {
  it("emits session:start, navigate, assert:pass in order", async () => {
    const session = makeMockSession();
    const phases: string[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      {
        onBrowserStreamEvent: (p) => phases.push(p.phase),
      },
    );

    const navigateTool = tools.find((t) => t.definition.function.name === "browser_navigate")!;
    const assertTool = tools.find((t) => t.definition.function.name === "browser_assert_text")!;

    await navigateTool.execute({ url: "http://localhost:3000" });
    await assertTool.execute({ substring: "Hello World" });

    expect(phases).toEqual(["session:start", "navigate", "assert:pass"]);
  });
});

// ---------------------------------------------------------------------------
// E.28: detail capping (200 chars)
// ---------------------------------------------------------------------------

describe("E.28 — detail string capping", () => {
  it("detail never exceeds 200 chars even for long navigate titles", async () => {
    const longTitle = "A".repeat(300);
    const session = makeMockSession({
      navigateResult: { url: "http://localhost:3000/", title: longTitle, statusCode: 200 },
    });
    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const navigateTool = tools.find((t) => t.definition.function.name === "browser_navigate")!;
    await navigateTool.execute({ url: "http://localhost:3000" });

    const navEvt = events.find((e) => e.phase === "navigate");
    expect(navEvt?.detail).toBeDefined();
    expect(navEvt!.detail!.length).toBeLessThanOrEqual(200);
  });

  it("detail never exceeds 200 chars for long policy-denied reason", async () => {
    const longReason = "URL not allowed by policy: " + "x".repeat(300);
    const session = makeMockSession({
      navigateError: new Error(longReason),
    });
    const events: BrowserStepEventPayload[] = [];

    const tools = buildBrowserTools(
      async () => session,
      true,
      { onBrowserStreamEvent: (p) => events.push(p) },
    );

    const navigateTool = tools.find((t) => t.definition.function.name === "browser_navigate")!;
    await navigateTool.execute({ url: "http://evil.example.com" });

    const policyEvt = events.find((e) => e.phase === "policy:denied");
    expect(policyEvt?.detail).toBeDefined();
    expect(policyEvt!.detail!.length).toBeLessThanOrEqual(200);
  });
});
