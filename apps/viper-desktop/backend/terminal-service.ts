import { ipcMain } from "electron";
import path from "path";

import type { IPty } from "node-pty";

const ptyMap = new Map<number, { pty: IPty }>();

function getPty(webContentsId: number): IPty | undefined {
  return ptyMap.get(webContentsId)?.pty;
}

export function setupTerminalService() {
  ipcMain.handle("terminal:create", async (event, workspaceRoot: string | null) => {
    const id = event.sender.id;
    const existing = ptyMap.get(id);
    if (existing) {
      try {
        existing.pty.kill();
      } catch {
        // ignore
      }
      ptyMap.delete(id);
    }

    let nodePty: typeof import("node-pty");
    try {
      nodePty = await import("node-pty");
    } catch (err) {
      console.error("terminal:create node-pty failed to load (rebuild for Electron? run: npx electron-rebuild):", err);
      return { ok: false, error: "Terminal runtime failed to load. Try: npx electron-rebuild" };
    }

    const fallbackCwd = process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
    const cwd = (workspaceRoot && workspaceRoot.trim() !== "") ? workspaceRoot : fallbackCwd;

    const shells: string[] =
      process.platform === "win32"
        ? [process.env.COMSPEC ?? "cmd.exe"]
        : [
            process.env.SHELL && path.isAbsolute(process.env.SHELL) ? process.env.SHELL : "",
            "/bin/zsh",
            "/bin/bash",
            "/bin/sh",
          ].filter(Boolean) as string[];

    for (const shell of shells) {
      try {
        const pty = nodePty.spawn(shell, [], {
          cwd,
          env: { ...process.env } as Record<string, string>,
          cols: 80,
          rows: 24,
        });

        pty.onData((data: string) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send("terminal:data", { data });
          }
        });

        pty.onExit(() => {
          ptyMap.delete(id);
        });

        ptyMap.set(id, { pty });
        return { ok: true, shell };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("terminal:create failed for shell", shell, err);
        if (shell === shells[shells.length - 1]) {
          return { ok: false, error: msg };
        }
      }
    }

    console.error("terminal:create: all shell candidates failed");
    return { ok: false, error: "No shell could be started" };
  });

  ipcMain.handle("terminal:write", (event, data: string) => {
    const pty = getPty(event.sender.id);
    if (pty) pty.write(data);
  });

  ipcMain.handle("terminal:resize", (event, cols: number, rows: number) => {
    const pty = getPty(event.sender.id);
    if (pty) {
      const c = Math.max(1, Math.min(cols || 80, 500));
      const r = Math.max(1, Math.min(rows || 24, 200));
      pty.resize(c, r);
    }
  });

  ipcMain.handle("terminal:destroy", (event) => {
    const id = event.sender.id;
    const entry = ptyMap.get(id);
    if (entry) {
      try {
        entry.pty.kill();
      } catch {
        // ignore
      }
      ptyMap.delete(id);
    }
  });
}
