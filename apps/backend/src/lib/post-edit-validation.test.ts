import { describe, it, expect, vi } from "vitest";
import { runPostEditValidationOrchestration } from "./post-edit-validation.js";
import type { OnStreamEvent } from "@repo/execution-engine";

describe("runPostEditValidationOrchestration", () => {
  it("emits started → passed when command succeeds", async () => {
    const events: Parameters<OnStreamEvent>[0][] = [];
    const runWorkspaceCommand = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: "ok",
      error: undefined,
    });

    const ok = await runPostEditValidationOrchestration({
      workspacePath: "/tmp/ws",
      command: "echo test",
      timeoutMs: 5000,
      toolName: "edit_file",
      onEvent: (e) => events.push(e),
      identity: null,
      debugWorkflow: false,
      runWorkspaceCommand,
    });

    expect(ok).toBe(true);
    expect(runWorkspaceCommand).toHaveBeenCalledWith("/tmp/ws", "echo test", 5000);
    expect(events.map((e) => e.type)).toEqual(["validation:started", "validation:passed"]);
    expect(events[1]).toMatchObject({
      type: "validation:passed",
      data: { exitCode: 0, summary: "ok" },
    });
  });

  it("emits failed on non-zero exit", async () => {
    const events: Parameters<OnStreamEvent>[0][] = [];
    const runWorkspaceCommand = vi.fn().mockResolvedValue({
      success: false,
      exitCode: 2,
      output: "types bad",
      error: "Exit code 2",
    });

    const ok = await runPostEditValidationOrchestration({
      workspacePath: "/tmp/ws",
      command: "npm run check-types",
      timeoutMs: 1000,
      toolName: "create_file",
      onEvent: (e) => events.push(e),
      identity: null,
      debugWorkflow: false,
      runWorkspaceCommand,
    });

    expect(ok).toBe(false);
    expect(events.map((e) => e.type)).toEqual(["validation:started", "validation:failed"]);
    expect(events[1]).toMatchObject({
      type: "validation:failed",
      data: { exitCode: 2 },
    });
  });

  it("emits failed when command is whitespace-only", async () => {
    const runWorkspaceCommand = vi.fn();
    const events: Parameters<OnStreamEvent>[0][] = [];

    const ok = await runPostEditValidationOrchestration({
      workspacePath: "/tmp/ws",
      command: "   ",
      timeoutMs: 1000,
      toolName: "edit_file",
      onEvent: (e) => events.push(e),
      identity: null,
      debugWorkflow: false,
      runWorkspaceCommand,
    });

    expect(ok).toBe(false);
    expect(runWorkspaceCommand).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === "validation:failed")).toBe(true);
  });
});
