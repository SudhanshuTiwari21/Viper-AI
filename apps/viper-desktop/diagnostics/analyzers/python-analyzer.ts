import path from "path";
import { spawn } from "child_process";
import type { Diagnostic } from "../types";

/** Run pyflakes on a single file and parse output into diagnostics. */
export function analyzePython(
  rootDir: string,
  relPath: string,
  _content: string
): Promise<Diagnostic[]> {
  return new Promise((resolve) => {
    const absPath = path.join(rootDir, relPath);
    const proc = spawn("python", ["-m", "pyflakes", absPath], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    proc.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr?.on("data", (chunk: Buffer) => chunks.push(chunk));

    proc.on("error", () => resolve([]));
    proc.on("close", (code, signal) => {
      if (code === 0 && !signal) {
        resolve([]);
        return;
      }
      const out = Buffer.concat(chunks).toString("utf8");
      const diagnostics = parsePyflakesOutput(relPath, out);
      resolve(diagnostics);
    });
  });
}

/** Parse pyflakes stdout/stderr: "file:line:col: message" or "file:line: message". */
function parsePyflakesOutput(relPath: string, output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = output.trim().split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    // path:line:col: message or path:line: message
    const match = line.match(/^[^:]+:(\d+):(?:\d+:)?\s*(.+)$/);
    if (match) {
      const lineNum = parseInt(match[1], 10);
      const message = match[2].trim();
      diagnostics.push({
        file: relPath,
        line: isNaN(lineNum) ? 1 : lineNum,
        message,
        severity: "error",
        source: "pyflakes",
      });
    }
  }

  return diagnostics;
}
