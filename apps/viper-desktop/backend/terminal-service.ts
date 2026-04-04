import { ipcMain } from "electron";
import path from "path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { stat } from "node:fs/promises";

import type { IPty } from "node-pty";

let nextTermId = 1;
type TerminalEntry = {
  webContentsId: number;
  pty?: IPty;
  proc?: ChildProcessWithoutNullStreams;
};
const ptyMap = new Map<string, TerminalEntry>();

async function resolveValidCwd(workspaceRoot: string | null): Promise<string> {
  const fallbackCwd = process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
  const candidate = workspaceRoot && workspaceRoot.trim() !== "" ? workspaceRoot : fallbackCwd;
  try {
    const s = await stat(candidate);
    if (s.isDirectory()) return candidate;
  } catch {}
  return fallbackCwd;
}

function buildPtyEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  if (!env.PATH || env.PATH.trim() === "") {
    env.PATH = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin";
  }
  env.TERM = env.TERM ?? "xterm-256color";
  return env;
}

async function spawnFallbackShell(
  shell: string,
  cwd: string,
  env: Record<string, string>,
): Promise<ChildProcessWithoutNullStreams> {
  return await new Promise((resolve, reject) => {
    const args = process.platform === "win32" ? [] : ["-i"];
    const proc = spawn(shell, args, {
      cwd,
      env,
      stdio: "pipe",
    });
    let settled = false;
    const onError = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const onSpawn = () => {
      if (settled) return;
      settled = true;
      proc.off("error", onError);
      resolve(proc);
    };
    proc.once("error", onError);
    proc.once("spawn", onSpawn);
  });
}

export function setupTerminalService() {
  ipcMain.handle("terminal:create", async (event, workspaceRoot: string | null) => {
    const termId = String(nextTermId++);

    let nodePty: typeof import("node-pty");
    try {
      nodePty = await import("node-pty");
    } catch (err) {
      console.error("terminal:create node-pty failed to load:", err);
      return { ok: false, error: "Terminal runtime failed to load. Try: npx electron-rebuild" };
    }

    const cwd = await resolveValidCwd(workspaceRoot);
    const env = buildPtyEnv();

    const shells: string[] =
      process.platform === "win32"
        ? [process.env.COMSPEC ?? "cmd.exe"]
        : [
            process.env.SHELL && path.isAbsolute(process.env.SHELL) ? process.env.SHELL : "",
            "/bin/zsh",
            "/bin/bash",
            "/bin/sh",
          ].filter(Boolean) as string[];

    let lastError = "No shell could be started";
    for (const shell of shells) {
      try {
        const pty = nodePty.spawn(shell, [], {
          cwd,
          env,
          cols: 80,
          rows: 24,
        });

        pty.onData((data: string) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send("terminal:data", { termId, data });
          }
        });

        pty.onExit(() => {
          ptyMap.delete(termId);
          if (!event.sender.isDestroyed()) {
            event.sender.send("terminal:exit", { termId });
          }
        });

        ptyMap.set(termId, { pty, webContentsId: event.sender.id });
        return { ok: true, termId, shell };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;
        console.error("terminal:create failed for shell", shell, "cwd:", cwd, "error:", err);
      }
    }

    const fallbackShell = shells.find(Boolean) ?? (process.platform === "win32" ? "cmd.exe" : "/bin/sh");
    try {
      const proc = await spawnFallbackShell(fallbackShell, cwd, env);
      proc.stdout.on("data", (data: Buffer) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("terminal:data", { termId, data: data.toString() });
        }
      });
      proc.stderr.on("data", (data: Buffer) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("terminal:data", { termId, data: data.toString() });
        }
      });
      proc.on("close", () => {
        ptyMap.delete(termId);
        if (!event.sender.isDestroyed()) {
          event.sender.send("terminal:exit", { termId });
        }
      });
      ptyMap.set(termId, { proc, webContentsId: event.sender.id });
      if (!event.sender.isDestroyed()) {
        event.sender.send("terminal:data", {
          termId,
          data: `[viper] PTY unavailable, using fallback shell (${fallbackShell}).\r\n`,
        });
      }
      return { ok: true, termId, shell: `${fallbackShell} (fallback)` };
    } catch (fallbackErr) {
      const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      return { ok: false, error: `${lastError}; fallback failed: ${msg}` };
    }
  });

  ipcMain.handle("terminal:write", (_event, termId: string, data: string) => {
    const entry = ptyMap.get(termId);
    if (entry?.pty) entry.pty.write(data);
    if (entry?.proc?.stdin.writable) entry.proc.stdin.write(data);
  });

  ipcMain.handle("terminal:resize", (_event, termId: string, cols: number, rows: number) => {
    const entry = ptyMap.get(termId);
    if (entry?.pty) {
      const c = Math.max(1, Math.min(cols || 80, 500));
      const r = Math.max(1, Math.min(rows || 24, 200));
      entry.pty.resize(c, r);
    }
  });

  ipcMain.handle("terminal:destroy", (_event, termId: string) => {
    const entry = ptyMap.get(termId);
    if (entry) {
      try {
        entry.pty?.kill();
        entry.proc?.kill("SIGTERM");
      } catch {}
      ptyMap.delete(termId);
    }
  });

  ipcMain.handle("terminal:destroyAll", (event) => {
    const senderId = event.sender.id;
    for (const [termId, entry] of ptyMap) {
      if (entry.webContentsId === senderId) {
        try {
          entry.pty?.kill();
          entry.proc?.kill("SIGTERM");
        } catch {}
        ptyMap.delete(termId);
      }
    }
  });
}
