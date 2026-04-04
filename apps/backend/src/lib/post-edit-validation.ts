import type { OnStreamEvent } from "@repo/execution-engine";
import type { RequestIdentity } from "../types/request-identity.js";
import type { RunCommandResult } from "@repo/workspace-tools";

const MAX_VALIDATION_TEXT = 4_000;
const MAX_AUTO_REPAIR_SUMMARY = 2_000;

export type RunWorkspaceCommandFn = (
  workspacePath: string,
  command: string,
  timeoutMs?: number,
) => Promise<RunCommandResult>;

function truncate(text: string, max = MAX_VALIDATION_TEXT): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export interface RunPostEditValidationOrchestrationParams {
  workspacePath: string;
  command: string;
  timeoutMs: number;
  toolName: string;
  onEvent: OnStreamEvent;
  identity: RequestIdentity | null;
  /** When set and `debugWorkflow` is true, emits structured workflow logs (VIPER_DEBUG_WORKFLOW=1). */
  workflowLog?: (
    stage: string,
    identity: RequestIdentity | null,
    data?: Record<string, unknown>,
  ) => void;
  debugWorkflow: boolean;
  runWorkspaceCommand: RunWorkspaceCommandFn;
}

export interface RunPostEditValidationWithAutoRepairParams
  extends RunPostEditValidationOrchestrationParams {
  enableAutoRepair: boolean;
  autoRepairCommand: string;
  autoRepairTimeoutMs: number;
  maxExtraValidationRuns: number;
}

/**
 * After a successful edit/create tool call: run one workspace command (e.g. typecheck) and
 * emit `validation:*` SSE events.
 * @returns `true` if validation passed (`exitCode === 0`), else `false`.
 */
export async function runPostEditValidationOrchestration(
  params: RunPostEditValidationOrchestrationParams,
): Promise<boolean> {
  const {
    workspacePath,
    command,
    timeoutMs,
    toolName,
    onEvent,
    identity,
    workflowLog,
    debugWorkflow,
    runWorkspaceCommand,
  } = params;

  const cmdTrim = command.trim();
  if (!cmdTrim) {
    onEvent({
      type: "validation:failed",
      data: {
        exitCode: -1,
        error: "Post-edit validation command is empty (set VIPER_POST_EDIT_VALIDATION_COMMAND)",
      },
    });
    if (debugWorkflow && workflowLog) {
      workflowLog("validation:failed", identity, {
        exitCode: -1,
        error: "empty_command",
        tool: toolName,
      });
    }
    return false;
  }

  onEvent({
    type: "validation:started",
    data: { command: cmdTrim, tool: toolName },
  });
  if (debugWorkflow && workflowLog) {
    workflowLog("validation:started", identity, {
      command: cmdTrim.slice(0, 240),
      tool: toolName,
    });
  }

  let result: RunCommandResult;
  try {
    result = await runWorkspaceCommand(workspacePath, cmdTrim, timeoutMs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const errText = truncate(msg);
    onEvent({
      type: "validation:failed",
      data: { exitCode: -1, error: errText },
    });
    if (debugWorkflow && workflowLog) {
      workflowLog("validation:failed", identity, {
        exitCode: -1,
        error: errText.slice(0, 500),
        tool: toolName,
      });
    }
    return false;
  }

  const summary = truncate(result.output ?? "");

  if (result.success && result.exitCode === 0) {
    onEvent({
      type: "validation:passed",
      data: { exitCode: 0 as const, summary },
    });
    if (debugWorkflow && workflowLog) {
      workflowLog("validation:passed", identity, {
        exitCode: 0,
        summary: summary.slice(0, 800),
        tool: toolName,
      });
    }
    return true;
  }

  const errMsg = truncate(
    result.error ?? (summary ? `Command failed: ${summary}` : "Command failed"),
  );
  onEvent({
    type: "validation:failed",
    data: {
      exitCode: result.exitCode,
      error: errMsg,
    },
  });
  if (debugWorkflow && workflowLog) {
    workflowLog("validation:failed", identity, {
      exitCode: result.exitCode,
      error: errMsg.slice(0, 800),
      tool: toolName,
    });
  }
  return false;
}

/**
 * B.9: First run is standard B.8 validation; on failure, optional bounded repair command + re-validation.
 * Fire-and-forget safe: catches internally; does not throw.
 */
export async function runPostEditValidationWithOptionalAutoRepair(
  params: RunPostEditValidationWithAutoRepairParams,
): Promise<void> {
  try {
    let passed = await runPostEditValidationOrchestration(params);
    if (passed || !params.enableAutoRepair) {
      return;
    }

    const {
      workspacePath,
      autoRepairCommand,
      autoRepairTimeoutMs,
      maxExtraValidationRuns,
      toolName,
      onEvent,
      identity,
      workflowLog,
      debugWorkflow,
      runWorkspaceCommand,
    } = params;

    for (let cycle = 1; cycle <= maxExtraValidationRuns; cycle++) {
      const repairTrim = autoRepairCommand.trim();
      if (!repairTrim) {
        onEvent({
          type: "auto-repair:attempt",
          data: {
            cycle,
            tool: toolName,
            skipped: true,
            reason: "empty_repair_command",
          },
        });
        if (debugWorkflow && workflowLog) {
          workflowLog("auto-repair:attempt", identity, {
            cycle,
            skipped: true,
            reason: "empty_repair_command",
            tool: toolName,
          });
        }
        onEvent({
          type: "auto-repair:result",
          data: {
            cycle,
            success: false,
            skipped: true,
            reason: "empty_repair_command",
          },
        });
        if (debugWorkflow && workflowLog) {
          workflowLog("auto-repair:result", identity, {
            cycle,
            skipped: true,
            success: false,
            reason: "empty_repair_command",
            tool: toolName,
          });
        }
        break;
      }

      onEvent({
        type: "auto-repair:attempt",
        data: { cycle, tool: toolName, command: repairTrim },
      });
      if (debugWorkflow && workflowLog) {
        workflowLog("auto-repair:attempt", identity, {
          cycle,
          command: repairTrim.slice(0, 240),
          tool: toolName,
        });
      }

      let repairResult: RunCommandResult;
      try {
        repairResult = await runWorkspaceCommand(workspacePath, repairTrim, autoRepairTimeoutMs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const errText = truncate(msg, MAX_AUTO_REPAIR_SUMMARY);
        onEvent({
          type: "auto-repair:result",
          data: {
            cycle,
            success: false,
            exitCode: -1,
            error: errText,
          },
        });
        if (debugWorkflow && workflowLog) {
          workflowLog("auto-repair:result", identity, {
            cycle,
            success: false,
            exitCode: -1,
            error: errText.slice(0, 500),
            tool: toolName,
          });
        }
        passed = await runPostEditValidationOrchestration(params);
        if (passed) return;
        continue;
      }

      const rSummary = truncate(repairResult.output ?? "", MAX_AUTO_REPAIR_SUMMARY);
      const repairOk = repairResult.success && repairResult.exitCode === 0;
      onEvent({
        type: "auto-repair:result",
        data: {
          cycle,
          success: repairOk,
          exitCode: repairResult.exitCode,
          summary: rSummary || undefined,
          error:
            !repairOk && repairResult.error
              ? truncate(repairResult.error, MAX_AUTO_REPAIR_SUMMARY)
              : undefined,
        },
      });
      if (debugWorkflow && workflowLog) {
        workflowLog("auto-repair:result", identity, {
          cycle,
          success: repairOk,
          exitCode: repairResult.exitCode,
          summary: rSummary.slice(0, 800),
          tool: toolName,
        });
      }

      passed = await runPostEditValidationOrchestration(params);
      if (passed) return;
    }
  } catch {
    // Bounded orchestration must never surface as unhandled rejection from fire-and-forget callers.
  }
}
