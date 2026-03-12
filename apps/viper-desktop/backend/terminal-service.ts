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

    const shell = process.platform === "win32"
      ? process.env.COMSPEC ?? "cmd.exe"
      : process.env.SHELL ?? "/bin/bash";

    const nodePty = await import("node-pty");
    const fallbackCwd = process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
    const cwd = (workspaceRoot && workspaceRoot.trim() !== "") ? workspaceRoot : fallbackCwd;
    const pty = nodePty.spawn(shell, [], {
      cwd,
      env: process.env as Record<string, string>,
      cols: 80,
      rows: 24,
    });

    pty.onData((data: string) => {
      event.sender.send("terminal:data", { data });
    });

    pty.onExit(() => {
      ptyMap.delete(id);
    });

    ptyMap.set(id, { pty });
    return { ok: true };
  });

  ipcMain.handle("terminal:write", (event, data: string) => {
    const pty = getPty(event.sender.id);
    if (pty) pty.write(data);
  });

  ipcMain.handle("terminal:resize", (event, cols: number, rows: number) => {
    const pty = getPty(event.sender.id);
    if (pty) pty.resize(cols, rows);
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
