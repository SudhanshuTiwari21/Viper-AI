import type { ChatMode } from "../validators/request.schemas.js";

/**
 * C.12 — Mode→tool policy: single source of truth for which OpenAI tool names
 * are permitted per ChatMode in the agentic / workspace tool loop.
 *
 * Tool names match `packages/agents/agentic-loop/prompt/workspace-tool-defs.ts`.
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

const POLICY: Record<ChatMode, ReadonlySet<string>> = {
  ask: READ_ONLY_TOOLS,
  plan: READ_ONLY_TOOLS,
  debug: DEBUG_TOOLS,
  agent: ALL_TOOLS,
};

export function getAllowedToolNames(mode: ChatMode): ReadonlySet<string> {
  return POLICY[mode] ?? ALL_TOOLS;
}

export function isToolAllowedByMode(mode: ChatMode, toolName: string): boolean {
  return getAllowedToolNames(mode).has(toolName);
}
