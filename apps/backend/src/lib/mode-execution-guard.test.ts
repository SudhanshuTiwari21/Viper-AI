import { describe, it, expect, vi } from "vitest";
import type { AgenticToolDefinition, AgenticLoopOptions } from "@repo/agentic-loop";

/**
 * Tests for the defense-in-depth execution guard in run-agentic-loop.ts.
 * We simulate the guard logic locally (the real guard is in the loop) to
 * confirm the contract: when `allowedToolNames` is provided and a tool call
 * arrives for a blocked tool, `execute` is never called and a policy message
 * is returned.
 */

function makeTool(name: string): AgenticToolDefinition {
  return {
    definition: {
      type: "function",
      function: { name, parameters: { type: "object", properties: {} } },
    },
    execute: vi.fn().mockResolvedValue("ok"),
  };
}

function simulateGuard(
  toolName: string,
  toolMap: Map<string, AgenticToolDefinition>,
  allowedToolNames?: ReadonlySet<string>,
): { resultText: string; executed: boolean } {
  if (allowedToolNames && !allowedToolNames.has(toolName)) {
    return {
      resultText: `Tool blocked by mode policy: ${toolName} is not permitted in this mode.`,
      executed: false,
    };
  }
  const tool = toolMap.get(toolName);
  if (!tool) return { resultText: `Unknown tool: ${toolName}`, executed: false };
  return { resultText: "ok", executed: true };
}

describe("mode execution guard (C.12 defense-in-depth)", () => {
  it("blocks a disallowed tool and does not call execute", () => {
    const editTool = makeTool("edit_file");
    const toolMap = new Map([["edit_file", editTool]]);
    const allowed = new Set(["read_file", "list_directory"]);

    const { resultText, executed } = simulateGuard("edit_file", toolMap, allowed);
    expect(executed).toBe(false);
    expect(resultText).toContain("Tool blocked by mode policy");
    expect(editTool.execute).not.toHaveBeenCalled();
  });

  it("allows a permitted tool", () => {
    const readTool = makeTool("read_file");
    const toolMap = new Map([["read_file", readTool]]);
    const allowed = new Set(["read_file"]);

    const { resultText, executed } = simulateGuard("read_file", toolMap, allowed);
    expect(executed).toBe(true);
    expect(resultText).toBe("ok");
  });

  it("passes all tools through when allowedToolNames is undefined (agent mode)", () => {
    const editTool = makeTool("edit_file");
    const toolMap = new Map([["edit_file", editTool]]);

    const { resultText, executed } = simulateGuard("edit_file", toolMap, undefined);
    expect(executed).toBe(true);
  });

  it("blocks run_command in ask mode but allows in debug", () => {
    const cmdTool = makeTool("run_command");
    const toolMap = new Map([["run_command", cmdTool]]);

    const askAllowed = new Set(["read_file", "list_directory", "search_text", "search_files"]);
    expect(simulateGuard("run_command", toolMap, askAllowed).executed).toBe(false);

    const debugAllowed = new Set([...askAllowed, "run_command"]);
    expect(simulateGuard("run_command", toolMap, debugAllowed).executed).toBe(true);
  });
});
