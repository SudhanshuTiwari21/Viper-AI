/**
 * E.26 / E.27 / E.28 — Browser tool definitions for the agentic loop.
 *
 * Only included when VIPER_BROWSER_TOOLS=1; at runtime `buildBrowserTools()`
 * returns an empty array when the env kill-switch is off.
 *
 * E.26 tools (preserved unchanged):
 *   browser_navigate   — open a URL, return title + status.
 *   browser_screenshot — capture a PNG of the current page.
 *
 * E.27 validation tools:
 *   browser_assert_text        — assert a substring exists on page / within selector.
 *   browser_wait_for_selector  — wait until a CSS selector is visible.
 *   browser_run_recipe         — run an ordered list of recipe steps as a single call.
 *
 * E.28 SSE streaming:
 *   BrowserToolCallbacks.onBrowserStreamEvent fires for each notable browser action
 *   with a small metadata payload (no base64/raw HTML). The caller (assistant.service.ts)
 *   converts this into a `browser:step` StreamEvent and forwards it to the SSE stream.
 *
 * Sessions are per-request: a single BrowserSession is shared across all
 * browser tool calls within one agentic loop run, then closed on completion.
 */

import type { AgenticToolDefinition } from "../loop/agentic-loop.types.js";
import {
  parseRecipeSteps,
  runRecipeSteps,
  formatRecipeResult,
  getAssertTimeoutMs,
  type PlaywrightPageLike,
  assertPageText,
} from "@repo/browser-runner";

/** Minimum context the tools need to manage the shared session. */
export interface BrowserToolSession {
  navigate(url: string): Promise<{ url: string; title: string; statusCode: number | null }>;
  screenshot(options?: { fullPage?: boolean }): Promise<{
    summary: string;
    base64: string;
    truncated: boolean;
    rawBytes: number;
  }>;
  isClosed: boolean;
}

/**
 * E.28 — Payload for the `browser:step` SSE event.
 * Kept intentionally small — no base64, no raw HTML.
 * String fields are capped at 200 chars before forwarding.
 */
export interface BrowserStepEventPayload {
  phase:
    | "session:start"
    | "navigate"
    | "screenshot"
    | "assert:pass"
    | "assert:fail"
    | "policy:denied"
    | "session:end";
  stepIndex?: number;
  detail?: string;
  url?: string;
  rawBytes?: number;
  kind?: string;
}

/** Cap a string at 200 characters to keep SSE payloads lean. */
function capDetail(s: string, max = 200): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

export interface BrowserToolCallbacks {
  /** Called on session start (first navigate). Used for workflow logging. */
  onSessionStart?: () => void;
  /** Called after navigate. */
  onNavigate?: (url: string) => void;
  /** Called after screenshot. */
  onScreenshot?: (rawBytes: number) => void;
  /** Called when a URL is denied by policy (before navigate). */
  onPolicyDenied?: (reason: string) => void;
  /** Called when browser tools are disabled (env kill-switch off). */
  onDisabled?: () => void;
  /** Called when an assertion passes (E.27). */
  onAssertPass?: (stepIndex: number, kind: string, detail: string) => void;
  /** Called when an assertion fails (E.27). */
  onAssertFail?: (stepIndex: number, kind: string, detail: string) => void;
  /**
   * E.28 — Fired for each significant browser action with a small metadata
   * payload suitable for forwarding as a `browser:step` SSE event.
   * The caller (assistant.service.ts) owns the conversion to StreamEvent so
   * this package does not need to import the execution-engine types.
   */
  onBrowserStreamEvent?: (payload: BrowserStepEventPayload) => void;
}

/**
 * Build the browser tool definitions for a single agentic loop run.
 *
 * @param getSession   Async factory that lazily opens and reuses a session.
 *                     The factory is called on the first browser tool use; the
 *                     caller is responsible for closing the session after the
 *                     loop completes (success or error).
 * @param enabled      Must be true (i.e. `isBrowserToolsEnabled()` returned true).
 *                     When false, returns an empty array and calls `callbacks.onDisabled`.
 * @param callbacks    Optional hooks for workflow logging / observability.
 */
export function buildBrowserTools(
  getSession: () => Promise<BrowserToolSession>,
  enabled: boolean,
  callbacks?: BrowserToolCallbacks,
): AgenticToolDefinition[] {
  if (!enabled) {
    callbacks?.onDisabled?.();
    return [];
  }

  return [
    {
      definition: {
        type: "function",
        function: {
          name: "browser_navigate",
          description:
            "Open a URL in a headless Chromium browser and return the page title and HTTP status. " +
            "Only http(s)://localhost and http(s)://127.0.0.1 are allowed by default (set VIPER_BROWSER_ALLOWED_ORIGINS for others). " +
            "Use this to verify your app is running correctly, check a page's content, or confirm a development server is up.",
          parameters: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description:
                  "The URL to navigate to. Must start with http:// or https:// and target localhost or 127.0.0.1.",
              },
            },
            required: ["url"],
          },
        },
      },
      execute: async (args) => {
        const url = String(args["url"] ?? "").trim();
        if (!url) return "No URL provided.";

        let session: BrowserToolSession;
        try {
          session = await getSession();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return `Browser session error: ${msg}`;
        }

        callbacks?.onSessionStart?.();
        callbacks?.onBrowserStreamEvent?.({ phase: "session:start" });

        try {
          const result = await session.navigate(url);
          callbacks?.onNavigate?.(result.url);
          callbacks?.onBrowserStreamEvent?.({
            phase: "navigate",
            url: result.url,
            detail: capDetail(`"${result.title}"${result.statusCode !== null ? ` (HTTP ${result.statusCode})` : ""}`),
          });
          const status = result.statusCode !== null ? ` (HTTP ${result.statusCode})` : "";
          return `Navigated to: ${result.url}${status}\nPage title: "${result.title}"`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("not allowed by policy")) {
            callbacks?.onPolicyDenied?.(msg);
            callbacks?.onBrowserStreamEvent?.({ phase: "policy:denied", detail: capDetail(msg) });
          }
          return `Navigation failed: ${msg}`;
        }
      },
    },

    {
      definition: {
        type: "function",
        function: {
          name: "browser_screenshot",
          description:
            "Capture a screenshot of the current page in the headless browser. " +
            "Returns a summary and a base64-encoded PNG. " +
            "Must be called after browser_navigate. " +
            "Use this to visually inspect the current state of a web page.",
          parameters: {
            type: "object",
            properties: {
              full_page: {
                type: "boolean",
                description: "If true, capture the full scrollable page (default: visible viewport only).",
              },
            },
            required: [],
          },
        },
      },
      execute: async (args) => {
        let session: BrowserToolSession;
        try {
          session = await getSession();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return `Browser session error: ${msg}`;
        }

        try {
          const result = await session.screenshot({
            fullPage: args["full_page"] === true,
          });
          callbacks?.onScreenshot?.(result.rawBytes);
          callbacks?.onBrowserStreamEvent?.({
            phase: "screenshot",
            rawBytes: result.rawBytes,
            detail: capDetail(result.summary),
          });
          return `${result.summary}\n\nScreenshot (base64 PNG):\n${result.base64}`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return `Screenshot failed: ${msg}`;
        }
      },
    },

    // -------------------------------------------------------------------------
    // E.27 validation tools
    // -------------------------------------------------------------------------

    {
      definition: {
        type: "function",
        function: {
          name: "browser_assert_text",
          description:
            "Assert that a specific text substring is present on the current page (or within a CSS selector). " +
            "Returns PASS or FAIL with a short explanation. " +
            "Must be called after browser_navigate. " +
            "Use this to verify visible content, headings, labels, or error messages.",
          parameters: {
            type: "object",
            properties: {
              substring: {
                type: "string",
                description: "The text string to search for (case-sensitive).",
              },
              selector: {
                type: "string",
                description:
                  "Optional CSS selector to scope the search (e.g. 'h1', '.error-message'). " +
                  "When omitted, searches the entire page body.",
              },
            },
            required: ["substring"],
          },
        },
      },
      execute: async (args) => {
        const substring = String(args["substring"] ?? "").trim();
        if (!substring) return "No substring provided.";

        let session: BrowserToolSession;
        try {
          session = await getSession();
        } catch (err) {
          return `Browser session error: ${err instanceof Error ? err.message : String(err)}`;
        }

        // Access the underlying Playwright page via duck typing
        const pw = session as unknown as { page: PlaywrightPageLike | null };
        if (!pw.page) return "No active page. Call browser_navigate first.";

        const selector = args["selector"] ? String(args["selector"]) : undefined;
        const { found, detail } = await assertPageText(
          pw.page,
          substring,
          selector,
          getAssertTimeoutMs(),
        );

        if (found) {
          callbacks?.onAssertPass?.(0, "assert_text", detail);
          callbacks?.onBrowserStreamEvent?.({
            phase: "assert:pass",
            kind: "assert_text",
            detail: capDetail(detail),
          });
          return `PASS: ${detail}`;
        } else {
          callbacks?.onAssertFail?.(0, "assert_text", detail);
          callbacks?.onBrowserStreamEvent?.({
            phase: "assert:fail",
            kind: "assert_text",
            detail: capDetail(detail),
          });
          return `FAIL: ${detail}`;
        }
      },
    },

    {
      definition: {
        type: "function",
        function: {
          name: "browser_wait_for_selector",
          description:
            "Wait until a CSS selector becomes visible on the current page. " +
            "Times out if the element does not appear within the configured timeout. " +
            "Use this before asserting or interacting with dynamic content that loads asynchronously.",
          parameters: {
            type: "object",
            properties: {
              selector: {
                type: "string",
                description: "CSS selector to wait for (e.g. '#app', '.loaded', 'h1').",
              },
              timeout_ms: {
                type: "number",
                description:
                  `Timeout in milliseconds (default: ${getAssertTimeoutMs()} ms). ` +
                  "Increase for slow-loading pages.",
              },
            },
            required: ["selector"],
          },
        },
      },
      execute: async (args) => {
        const selector = String(args["selector"] ?? "").trim();
        if (!selector) return "No selector provided.";

        let session: BrowserToolSession;
        try {
          session = await getSession();
        } catch (err) {
          return `Browser session error: ${err instanceof Error ? err.message : String(err)}`;
        }

        const pw = session as unknown as { page: PlaywrightPageLike | null };
        if (!pw.page) return "No active page. Call browser_navigate first.";

        const timeout =
          typeof args["timeout_ms"] === "number" && args["timeout_ms"] > 0
            ? args["timeout_ms"]
            : getAssertTimeoutMs();

        try {
          await pw.page.waitForSelector(selector, { timeout, state: "visible" });
          const detail = `Selector "${selector}" is visible.`;
          callbacks?.onAssertPass?.(0, "wait_for_selector", detail);
          callbacks?.onBrowserStreamEvent?.({
            phase: "assert:pass",
            kind: "wait_for_selector",
            detail: capDetail(detail),
          });
          return `PASS: ${detail}`;
        } catch (err) {
          const detail = `Selector "${selector}" not visible within ${timeout}ms: ${err instanceof Error ? err.message : String(err)}`;
          callbacks?.onAssertFail?.(0, "wait_for_selector", detail);
          callbacks?.onBrowserStreamEvent?.({
            phase: "assert:fail",
            kind: "wait_for_selector",
            detail: capDetail(detail),
          });
          return `FAIL: ${detail}`;
        }
      },
    },

    {
      definition: {
        type: "function",
        function: {
          name: "browser_run_recipe",
          description:
            "Run an ordered sequence of browser validation steps (navigate, wait_for_selector, assert_text, screenshot) " +
            "as a single atomic call. " +
            "Steps execute in order; execution stops on the first failure (except screenshot steps, which are non-fatal). " +
            "Returns a PASS/FAIL report with per-step details. " +
            "Use this to validate multi-step user flows, page loads, or functional smoke tests.",
          parameters: {
            type: "object",
            properties: {
              steps: {
                type: "array",
                description:
                  "Ordered array of recipe steps. Each step is an object with a 'type' field " +
                  "and type-specific parameters: " +
                  "{ type: 'navigate', url: string } | " +
                  "{ type: 'wait_for_selector', selector: string, timeoutMs?: number } | " +
                  "{ type: 'assert_text', substring: string, selector?: string } | " +
                  "{ type: 'screenshot', fullPage?: boolean }",
                items: { type: "object" },
              },
            },
            required: ["steps"],
          },
        },
      },
      execute: async (args) => {
        const parsed = parseRecipeSteps(args["steps"]);
        if ("error" in parsed) return `Recipe validation error: ${parsed.error}`;

        let session: import("@repo/browser-runner").BrowserSession;
        try {
          session = await getSession() as import("@repo/browser-runner").BrowserSession;
        } catch (err) {
          return `Browser session error: ${err instanceof Error ? err.message : String(err)}`;
        }

        const result = await runRecipeSteps(session, parsed.steps, {
          onAssertPass: (stepIndex, kind, detail) => {
            callbacks?.onAssertPass?.(stepIndex, kind, detail);
            callbacks?.onBrowserStreamEvent?.({
              phase: "assert:pass",
              stepIndex,
              kind,
              detail: capDetail(detail),
            });
          },
          onAssertFail: (stepIndex, kind, detail) => {
            callbacks?.onAssertFail?.(stepIndex, kind, detail);
            callbacks?.onBrowserStreamEvent?.({
              phase: "assert:fail",
              stepIndex,
              kind,
              detail: capDetail(detail),
            });
          },
        });

        return formatRecipeResult(result);
      },
    },
  ];
}
