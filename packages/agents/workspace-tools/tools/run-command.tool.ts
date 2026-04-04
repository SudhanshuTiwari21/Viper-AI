import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { RunCommandResult } from "../workspace-tools.types.js";

const MAX_OUTPUT_BYTES = 32_000;
const DEFAULT_TIMEOUT_MS = 30_000;

const BLOCKED_PATTERNS = [
  /\brm\s+-rf\s+[\/~]/i,
  /\bsudo\b/i,
  /\b(shutdown|reboot|halt)\b/i,
  /\bformat\s+[a-z]:/i,
  />\s*\/dev\/sd/i,
  /\bmkfs\b/i,
];

export interface RunCommandCallbacks {
  onOutput?: (chunk: string) => void;
}

export async function runWorkspaceCommand(
  workspacePath: string,
  command: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  callbacks?: RunCommandCallbacks,
): Promise<RunCommandResult> {
  const cwd = resolve(workspacePath);
  if (!command.trim()) {
    return { success: false, exitCode: -1, output: "", error: "Empty command" };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return {
        success: false,
        exitCode: -1,
        output: "",
        error: `Blocked: command matches dangerous pattern (${pattern.source})`,
      };
    }
  }

  return new Promise((res) => {
    const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
    const shellArgs = process.platform === "win32" ? ["/c", command] : ["-c", command];

    const child = spawn(shell, shellArgs, {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let errOutput = "";
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
      }, 2000);
    }, timeoutMs);

    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (output.length < MAX_OUTPUT_BYTES) {
        output += chunk.slice(0, MAX_OUTPUT_BYTES - output.length);
      }
      callbacks?.onOutput?.(chunk);
    });

    child.stderr.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (errOutput.length < MAX_OUTPUT_BYTES / 2) {
        errOutput += chunk.slice(0, MAX_OUTPUT_BYTES / 2 - errOutput.length);
      }
      callbacks?.onOutput?.(chunk);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      const exitCode = code ?? (killed ? 124 : 1);

      if (errOutput && !output.includes(errOutput)) {
        output = output
          ? `${output}\n--- stderr ---\n${errOutput}`
          : errOutput;
      }

      if (killed) {
        res({
          success: false,
          exitCode: 124,
          output: output || "",
          error: `Command timed out after ${timeoutMs}ms`,
        });
        return;
      }

      res({
        success: exitCode === 0,
        exitCode,
        output,
        error: exitCode !== 0 ? `Exit code ${exitCode}` : undefined,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      res({
        success: false,
        exitCode: -1,
        output: output || "",
        error: err.message,
      });
    });
  });
}
