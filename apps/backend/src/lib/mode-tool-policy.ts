import type { ChatMode } from "../validators/request.schemas.js";

/**
 * C.12 — Mode→tool policy: single source of truth for which OpenAI tool names
 * are permitted per ChatMode in the agentic / workspace tool loop.
 *
 * Tool names match `packages/agents/agentic-loop/prompt/workspace-tool-defs.ts`
 * and `packages/agents/agentic-loop/prompt/browser-tool-defs.ts` (E.26).
 *
 * E.26 browser tools policy:
 *   - Only available in `debug` and `agent` modes.
 *   - Only registered when VIPER_BROWSER_TOOLS=1 (checked at tool-build time,
 *     not here — this file only gates by mode name).
 *   - `ask` and `plan` modes never see browser tools in their allowed set.
 */

const READ_ONLY_TOOLS = new Set([
  "read_file",
  "list_directory",
  "search_text",
  "search_files",
]);

const DEBUG_TOOLS = new Set([
  ...READ_ONLY_TOOLS,
  "run_command",
]);

const ALL_TOOLS = new Set([
  ...DEBUG_TOOLS,
  "edit_file",
  "create_file",
]);

// E.26 + E.27: browser tool names permitted in debug + agent (not ask/plan).
// These are only present in the tool array when VIPER_BROWSER_TOOLS=1;
// the set here is the mode-level gate (second layer of defense-in-depth).
export const BROWSER_TOOLS = new Set([
  // E.26 base tools
  "browser_navigate",
  "browser_screenshot",
  // E.27 validation tools
  "browser_assert_text",
  "browser_wait_for_selector",
  "browser_run_recipe",
]);

const DEBUG_WITH_BROWSER = new Set([...DEBUG_TOOLS, ...BROWSER_TOOLS]);
const ALL_WITH_BROWSER = new Set([...ALL_TOOLS, ...BROWSER_TOOLS]);

const POLICY: Record<ChatMode, ReadonlySet<string>> = {
  ask: READ_ONLY_TOOLS,
  plan: READ_ONLY_TOOLS,
  debug: DEBUG_WITH_BROWSER,
  agent: ALL_WITH_BROWSER,
};

export function getAllowedToolNames(mode: ChatMode): ReadonlySet<string> {
  return POLICY[mode] ?? ALL_WITH_BROWSER;
}

export function isToolAllowedByMode(mode: ChatMode, toolName: string): boolean {
  return getAllowedToolNames(mode).has(toolName);
}

/** Returns true when the given tool name is a browser runner tool (E.26). */
export function isBrowserTool(toolName: string): boolean {
  return BROWSER_TOOLS.has(toolName);
}
