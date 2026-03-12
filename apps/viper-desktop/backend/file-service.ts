import fs from "fs/promises";
import path from "path";
import { ipcMain, BrowserWindow } from "electron";
import chokidar from "chokidar";

function resolvePath(root: string, rel: string): string {
  return path.isAbsolute(rel) ? rel : path.join(root, rel);
}

let currentWatcher: ReturnType<typeof chokidar.watch> | null = null;

function sendToAll(channel: string, payload: unknown) {
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send(channel, payload);
  });
}

export function setupFileService() {
  ipcMain.handle("file:read", async (_e, root: string, rel: string) => {
    const full = resolvePath(root, rel);
    return fs.readFile(full, "utf8");
  });

  ipcMain.handle("file:write", async (_e, root: string, rel: string, content: string) => {
    const full = resolvePath(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf8");
  });

  ipcMain.handle("file:create", async (_e, root: string, rel: string) => {
    const full = resolvePath(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, "", "utf8");
  });

  ipcMain.handle("file:createFolder", async (_e, root: string, rel: string) => {
    const full = resolvePath(root, rel);
    await fs.mkdir(full, { recursive: true });
  });

  ipcMain.handle("file:delete", async (_e, root: string, rel: string) => {
    const full = resolvePath(root, rel);
    await fs.rm(full, { recursive: true, force: true });
  });

  ipcMain.handle("file:rename", async (_e, root: string, oldRel: string, newRel: string) => {
    const from = resolvePath(root, oldRel);
    const to = resolvePath(root, newRel);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
  });

  ipcMain.handle("workspace:watch", async (_e, root: string | null) => {
    if (currentWatcher) {
      currentWatcher.close();
      currentWatcher = null;
    }
    if (!root) return;
    currentWatcher = chokidar.watch(root, {
      ignoreInitial: true,
      persistent: true,
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/.viper/**",
        "**/.next/**",
        "**/.cache/**",
        "**/.turbo/**",
        "**/out/**",
        "**/.vite/**",
      ],
    });

    const notify = (filePath: string) => {
      sendToAll("file:changed", { path: filePath });
    };

    currentWatcher
      .on("change", notify)
      .on("add", notify)
      .on("addDir", notify)
      .on("unlink", notify)
      .on("unlinkDir", notify);
  });
}
