import { describe, it, expect, vi } from "vitest";
import { runPostEditValidationWithOptionalAutoRepair } from "./post-edit-validation.js";
import type { OnStreamEvent } from "@repo/execution-engine";

const baseParams = {
  workspacePath: "/tmp/ws",
  command: "npm run validate",
  timeoutMs: 5000,
  toolName: "edit_file",
  onEvent: ((_e: Parameters<OnStreamEvent>[0]) => {}) as OnStreamEvent,
  identity: null,
  debugWorkflow: false,
  runWorkspaceCommand: vi.fn(),
};

describe("runPostEditValidationWithOptionalAutoRepair", () => {
  it("does not run repair when auto-repair disabled (validation fails once)", async () => {
    const events: Parameters<OnStreamEvent>[0][] = [];
    const runWorkspaceCommand = vi.fn().mockResolvedValue({
      success: false,
      exitCode: 1,
      output: "bad",
      error: "Exit code 1",
    });

    await runPostEditValidationWithOptionalAutoRepair({
      ...baseParams,
      onEvent: (e) => events.push(e),
      runWorkspaceCommand,
      enableAutoRepair: false,
      autoRepairCommand: "npm run fix",
      autoRepairTimeoutMs: 3000,
      maxExtraValidationRuns: 2,
    });

    expect(runWorkspaceCommand).toHaveBeenCalledTimes(1);
    expect(events.filter((e) => e.type === "validation:started").length).toBe(1);
    expect(events.some((e) => e.type === "auto-repair:attempt")).toBe(false);
  });

  it("skips repair with empty command: attempt/result skipped, no second validation", async () => {
    const events: Parameters<OnStreamEvent>[0][] = [];
    const runWorkspaceCommand = vi.fn().mockResolvedValue({
      success: false,
      exitCode: 1,
      output: "x",
      error: "e",
    });

    await runPostEditValidationWithOptionalAutoRepair({
      ...baseParams,
      onEvent: (e) => events.push(e),
      runWorkspaceCommand,
      enableAutoRepair: true,
      autoRepairCommand: "   ",
      autoRepairTimeoutMs: 3000,
      maxExtraValidationRuns: 2,
    });

    expect(runWorkspaceCommand).toHaveBeenCalledTimes(1);
    const attempt = events.find((e) => e.type === "auto-repair:attempt");
    expect(attempt).toMatchObject({
      type: "auto-repair:attempt",
      data: { skipped: true, reason: "empty_repair_command" },
    });
    const result = events.find((e) => e.type === "auto-repair:result");
    expect(result).toMatchObject({
      type: "auto-repair:result",
      data: { skipped: true, reason: "empty_repair_command" },
    });
    expect(events.filter((e) => e.type === "validation:started").length).toBe(1);
  });

  it("repair succeeds then second validation passes", async () => {
    const events: Parameters<OnStreamEvent>[0][] = [];
    const runWorkspaceCommand = vi
      .fn()
      // first: validation fails
      .mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        output: "types",
        error: "fail",
      })
      // repair ok
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        output: "fixed",
        error: undefined,
      })
      // re-validation passes
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        output: "ok",
        error: undefined,
      });

    await runPostEditValidationWithOptionalAutoRepair({
      ...baseParams,
      onEvent: (e) => events.push(e),
      runWorkspaceCommand,
      enableAutoRepair: true,
      autoRepairCommand: "npm run fix",
      autoRepairTimeoutMs: 3000,
      maxExtraValidationRuns: 1,
    });

    expect(runWorkspaceCommand).toHaveBeenCalledTimes(3);
    expect(events.filter((e) => e.type === "validation:passed").length).toBe(1);
    expect(events.filter((e) => e.type === "validation:failed").length).toBe(1);
    expect(events.some((e) => e.type === "auto-repair:attempt" && !(e as { data: { skipped?: boolean } }).data.skipped)).toBe(
      true,
    );
    expect(events.some((e) => e.type === "auto-repair:result" && (e as { data: { success: boolean } }).data.success)).toBe(
      true,
    );
  });

  it("repair succeeds but validation still fails: ends after maxExtraValidationRuns", async () => {
    const events: Parameters<OnStreamEvent>[0][] = [];
    const failVal = { success: false, exitCode: 1, output: "fail", error: "e" };
    const okRepair = { success: true, exitCode: 0, output: "", error: undefined as string | undefined };
    const runWorkspaceCommand = vi
      .fn()
      .mockResolvedValueOnce(failVal) // validation 1
      .mockResolvedValueOnce(okRepair) // repair 1
      .mockResolvedValueOnce(failVal) // validation 2
      .mockResolvedValueOnce(okRepair) // repair 2
      .mockResolvedValueOnce(failVal); // validation 3

    await runPostEditValidationWithOptionalAutoRepair({
      ...baseParams,
      onEvent: (e) => events.push(e),
      runWorkspaceCommand,
      enableAutoRepair: true,
      autoRepairCommand: "npm run fix",
      autoRepairTimeoutMs: 3000,
      maxExtraValidationRuns: 2,
    });

    // 1 initial validation + 2×(repair + validation) = 5 command invocations
    expect(runWorkspaceCommand).toHaveBeenCalledTimes(5);
    expect(events.filter((e) => e.type === "validation:started").length).toBe(3);
    expect(events.filter((e) => e.type === "validation:failed").length).toBe(3);
    expect(events.filter((e) => e.type === "auto-repair:attempt").length).toBe(2);
  });

  it("stops after first validation when it passes (no repair)", async () => {
    const events: Parameters<OnStreamEvent>[0][] = [];
    const runWorkspaceCommand = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: "ok",
      error: undefined,
    });

    await runPostEditValidationWithOptionalAutoRepair({
      ...baseParams,
      onEvent: (e) => events.push(e),
      runWorkspaceCommand,
      enableAutoRepair: true,
      autoRepairCommand: "npm run fix",
      autoRepairTimeoutMs: 3000,
      maxExtraValidationRuns: 3,
    });

    expect(runWorkspaceCommand).toHaveBeenCalledTimes(1);
    expect(events.map((e) => e.type)).toEqual(["validation:started", "validation:passed"]);
  });
});
