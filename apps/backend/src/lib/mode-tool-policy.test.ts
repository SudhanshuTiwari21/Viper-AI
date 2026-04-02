/**
 * E.26 / E.27 — Mode-tool policy tests: browser tool gating.
 * Extends existing C.12 contract with browser-specific assertions.
 */
import { describe, it, expect } from "vitest";
import {
  getAllowedToolNames,
  isToolAllowedByMode,
  isBrowserTool,
  BROWSER_TOOLS,
} from "./mode-tool-policy.js";

// ---------------------------------------------------------------------------
// Existing workspace tools — regression
// ---------------------------------------------------------------------------

describe("getAllowedToolNames — existing tools (regression)", () => {
  it("ask: read-only set only", () => {
    const allowed = getAllowedToolNames("ask");
    expect(allowed.has("read_file")).toBe(true);
    expect(allowed.has("list_directory")).toBe(true);
    expect(allowed.has("run_command")).toBe(false);
    expect(allowed.has("edit_file")).toBe(false);
    expect(allowed.has("create_file")).toBe(false);
  });

  it("plan: same as ask (read-only)", () => {
    const allowed = getAllowedToolNames("plan");
    expect(allowed.has("read_file")).toBe(true);
    expect(allowed.has("run_command")).toBe(false);
    expect(allowed.has("edit_file")).toBe(false);
  });

  it("debug: read-only + run_command", () => {
    const allowed = getAllowedToolNames("debug");
    expect(allowed.has("run_command")).toBe(true);
    expect(allowed.has("edit_file")).toBe(false);
  });

  it("agent: all workspace tools", () => {
    const allowed = getAllowedToolNames("agent");
    expect(allowed.has("edit_file")).toBe(true);
    expect(allowed.has("create_file")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// E.26 — Browser tool mode gating
// ---------------------------------------------------------------------------

describe("getAllowedToolNames — E.26 browser tools", () => {
  it("ask: browser tools NOT allowed", () => {
    const allowed = getAllowedToolNames("ask");
    expect(allowed.has("browser_navigate")).toBe(false);
    expect(allowed.has("browser_screenshot")).toBe(false);
  });

  it("plan: browser tools NOT allowed", () => {
    const allowed = getAllowedToolNames("plan");
    expect(allowed.has("browser_navigate")).toBe(false);
    expect(allowed.has("browser_screenshot")).toBe(false);
  });

  it("debug: browser tools allowed", () => {
    const allowed = getAllowedToolNames("debug");
    expect(allowed.has("browser_navigate")).toBe(true);
    expect(allowed.has("browser_screenshot")).toBe(true);
  });

  it("agent: browser tools allowed", () => {
    const allowed = getAllowedToolNames("agent");
    expect(allowed.has("browser_navigate")).toBe(true);
    expect(allowed.has("browser_screenshot")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isToolAllowedByMode
// ---------------------------------------------------------------------------

describe("isToolAllowedByMode — browser tools", () => {
  it("browser_navigate not allowed in ask", () => {
    expect(isToolAllowedByMode("ask", "browser_navigate")).toBe(false);
  });

  it("browser_navigate not allowed in plan", () => {
    expect(isToolAllowedByMode("plan", "browser_navigate")).toBe(false);
  });

  it("browser_navigate allowed in debug", () => {
    expect(isToolAllowedByMode("debug", "browser_navigate")).toBe(true);
  });

  it("browser_screenshot allowed in agent", () => {
    expect(isToolAllowedByMode("agent", "browser_screenshot")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isBrowserTool helper
// ---------------------------------------------------------------------------

describe("isBrowserTool", () => {
  it("returns true for browser_navigate", () => {
    expect(isBrowserTool("browser_navigate")).toBe(true);
  });

  it("returns true for browser_screenshot", () => {
    expect(isBrowserTool("browser_screenshot")).toBe(true);
  });

  it("returns false for read_file", () => {
    expect(isBrowserTool("read_file")).toBe(false);
  });

  it("returns false for unknown tool", () => {
    expect(isBrowserTool("unknown_tool")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BROWSER_TOOLS set
// ---------------------------------------------------------------------------

describe("BROWSER_TOOLS set", () => {
  it("contains E.26 tools: browser_navigate and browser_screenshot", () => {
    expect(BROWSER_TOOLS.has("browser_navigate")).toBe(true);
    expect(BROWSER_TOOLS.has("browser_screenshot")).toBe(true);
  });

  it("contains E.27 tools: browser_assert_text, browser_wait_for_selector, browser_run_recipe", () => {
    expect(BROWSER_TOOLS.has("browser_assert_text")).toBe(true);
    expect(BROWSER_TOOLS.has("browser_wait_for_selector")).toBe(true);
    expect(BROWSER_TOOLS.has("browser_run_recipe")).toBe(true);
  });

  it("has exactly 5 browser tools total (E.26 + E.27)", () => {
    expect(BROWSER_TOOLS.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// E.27 — mode gating for validation tools
// ---------------------------------------------------------------------------

describe("getAllowedToolNames — E.27 validation tools", () => {
  const e27Tools = ["browser_assert_text", "browser_wait_for_selector", "browser_run_recipe"];

  it("ask: E.27 tools NOT allowed", () => {
    const allowed = getAllowedToolNames("ask");
    for (const t of e27Tools) {
      expect(allowed.has(t)).toBe(false);
    }
  });

  it("plan: E.27 tools NOT allowed", () => {
    const allowed = getAllowedToolNames("plan");
    for (const t of e27Tools) {
      expect(allowed.has(t)).toBe(false);
    }
  });

  it("debug: E.27 tools allowed", () => {
    const allowed = getAllowedToolNames("debug");
    for (const t of e27Tools) {
      expect(allowed.has(t)).toBe(true);
    }
  });

  it("agent: E.27 tools allowed", () => {
    const allowed = getAllowedToolNames("agent");
    for (const t of e27Tools) {
      expect(allowed.has(t)).toBe(true);
    }
  });
});

describe("isBrowserTool — E.27 tools", () => {
  it("returns true for browser_assert_text", () => {
    expect(isBrowserTool("browser_assert_text")).toBe(true);
  });

  it("returns true for browser_wait_for_selector", () => {
    expect(isBrowserTool("browser_wait_for_selector")).toBe(true);
  });

  it("returns true for browser_run_recipe", () => {
    expect(isBrowserTool("browser_run_recipe")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// browser-tool-defs: env kill-switch (buildBrowserTools with enabled=false)
// ---------------------------------------------------------------------------

describe("buildBrowserTools — env kill-switch off", () => {
  it("returns empty array when enabled=false", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(async () => { throw new Error("should not be called"); }, false);
    expect(tools).toHaveLength(0);
  });

  it("calls onDisabled callback when enabled=false", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    let called = false;
    buildBrowserTools(
      async () => { throw new Error("should not be called"); },
      false,
      { onDisabled: () => { called = true; } },
    );
    expect(called).toBe(true);
  });

  it("returns 5 tools when enabled=true (E.26 + E.27)", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(async () => { throw new Error("session"); }, true);
    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.definition.function.name)).toEqual([
      "browser_navigate",
      "browser_screenshot",
      "browser_assert_text",
      "browser_wait_for_selector",
      "browser_run_recipe",
    ]);
  });
});

// ---------------------------------------------------------------------------
// browser-tool-defs: execute returns safe message when session factory throws
// ---------------------------------------------------------------------------

describe("buildBrowserTools — graceful session error", () => {
  it("navigate returns error string when session factory throws", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(
      async () => { throw new Error("Playwright not installed"); },
      true,
    );
    const navigateTool = tools.find((t) => t.definition.function.name === "browser_navigate")!;
    const result = await navigateTool.execute({ url: "http://localhost:3000" });
    expect(result).toContain("Browser session error");
    expect(result).toContain("Playwright not installed");
  });

  it("navigate returns safe string for empty URL", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(
      async () => { throw new Error("session"); },
      true,
    );
    const navigateTool = tools.find((t) => t.definition.function.name === "browser_navigate")!;
    const result = await navigateTool.execute({ url: "" });
    expect(result).toBe("No URL provided.");
  });
});

// ---------------------------------------------------------------------------
// E.27 tool execution — unit tests
// ---------------------------------------------------------------------------

describe("buildBrowserTools — E.27 assert / wait / recipe tool inputs", () => {
  it("browser_assert_text returns safe message for empty substring", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(async () => { throw new Error("session"); }, true);
    const tool = tools.find((t) => t.definition.function.name === "browser_assert_text")!;
    expect(await tool.execute({ substring: "" })).toBe("No substring provided.");
  });

  it("browser_assert_text returns session error when session factory throws", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(
      async () => { throw new Error("Playwright not installed"); },
      true,
    );
    const tool = tools.find((t) => t.definition.function.name === "browser_assert_text")!;
    const result = await tool.execute({ substring: "hello" });
    expect(result).toContain("Browser session error");
  });

  it("browser_wait_for_selector returns safe message for empty selector", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(async () => { throw new Error("session"); }, true);
    const tool = tools.find((t) => t.definition.function.name === "browser_wait_for_selector")!;
    expect(await tool.execute({ selector: "" })).toBe("No selector provided.");
  });

  it("browser_wait_for_selector returns session error when session factory throws", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(
      async () => { throw new Error("Playwright not installed"); },
      true,
    );
    const tool = tools.find((t) => t.definition.function.name === "browser_wait_for_selector")!;
    const result = await tool.execute({ selector: "#app" });
    expect(result).toContain("Browser session error");
  });

  it("browser_run_recipe returns validation error for bad steps", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(async () => { throw new Error("session"); }, true);
    const tool = tools.find((t) => t.definition.function.name === "browser_run_recipe")!;
    const result = await tool.execute({ steps: "not-an-array" });
    expect(result).toContain("Recipe validation error");
  });

  it("browser_run_recipe returns validation error for too many steps", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const { DEFAULT_MAX_RECIPE_STEPS } = await import("@repo/browser-runner");
    const tools = buildBrowserTools(async () => { throw new Error("session"); }, true);
    const tool = tools.find((t) => t.definition.function.name === "browser_run_recipe")!;
    const steps = Array.from({ length: DEFAULT_MAX_RECIPE_STEPS + 1 }, () => ({
      type: "navigate",
      url: "http://localhost/",
    }));
    const result = await tool.execute({ steps });
    expect(result).toContain("Recipe validation error");
    expect(result).toContain("Too many steps");
  });

  it("browser_run_recipe returns session error when factory throws and steps are valid", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(
      async () => { throw new Error("Playwright not installed"); },
      true,
    );
    const tool = tools.find((t) => t.definition.function.name === "browser_run_recipe")!;
    const result = await tool.execute({
      steps: [{ type: "navigate", url: "http://localhost/" }],
    });
    expect(result).toContain("Browser session error");
  });
});

// ---------------------------------------------------------------------------
// E.27 — env-off regression (new tools also absent when disabled)
// ---------------------------------------------------------------------------

describe("buildBrowserTools — E.27 env-off regression", () => {
  it("returns empty array when enabled=false (no new tools either)", async () => {
    const { buildBrowserTools } = await import("@repo/agentic-loop");
    const tools = buildBrowserTools(async () => { throw new Error("session"); }, false);
    expect(tools).toHaveLength(0);
  });
});
