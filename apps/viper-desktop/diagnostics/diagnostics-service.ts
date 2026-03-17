import path from "path";
import fs from "fs/promises";
import chokidar from "chokidar";
import { BrowserWindow, ipcMain } from "electron";
import type { Diagnostic, SerializedDiagnosticsMap } from "./types";
import {
  collectFilePaths,
  runAnalyzers,
  serializeDiagnosticsMap,
} from "./diagnostics-worker";

let currentRoot: string | null = null;
let currentMap = new Map<string, Diagnostic[]>();
let watcher: ReturnType<typeof chokidar.watch> | null = null;
let scanPromise: Promise<void> | null = null;

function sendToAll(channel: string, payload: unknown) {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  });
}

function getRelPath(absPath: string): string | null {
  if (!currentRoot) return null;
  const rel = path.relative(currentRoot, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return path.sep === "\\" ? rel.replace(/\\/g, "/") : rel;
}

async function readFile(relPath: string): Promise<string> {
  if (!currentRoot) return "";
  return fs.readFile(path.join(currentRoot, relPath), "utf8");
}

async function runFullScan(rootDir: string): Promise<void> {
  try {
    const files = await collectFilePaths(rootDir);
    const map = await runAnalyzers(rootDir, files, readFile);
    currentMap = map;
    sendToAll("diagnostics:update", serializeDiagnosticsMap(map));
  } catch (err) {
    console.error("[diagnostics] Full scan failed:", err);
    currentMap = new Map();
    sendToAll("diagnostics:update", []);
  }
}

async function runIncrementalForFile(relPath: string): Promise<void> {
  if (!currentRoot) return;
  try {
    const map = await runAnalyzers(currentRoot, [relPath], readFile);
    const fileDiag = map.get(relPath) ?? [];
    if (fileDiag.length === 0) {
      currentMap.delete(relPath);
    } else {
      currentMap.set(relPath, fileDiag);
    }
    sendToAll("diagnostics:update", serializeDiagnosticsMap(currentMap));
  } catch {
    // ignore per-file errors
  }
}

export function setupDiagnosticsService(): void {
  ipcMain.handle("diagnostics:start", async (_e, root: string | null) => {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
    currentMap = new Map();
    currentRoot = root;
    if (!root) {
      sendToAll("diagnostics:update", []);
      return;
    }
    if (scanPromise) await scanPromise;
    scanPromise = runFullScan(root);
    await scanPromise;
    scanPromise = null;

    watcher = chokidar.watch(root, {
      ignoreInitial: true,
      usePolling: true,
      interval: 2000,
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/.next/**",
        "**/.cache/**",
        "**/.turbo/**",
        "**/out/**",
        "**/.vite/**",
        "**/.viper/**",
        "**/.cursor/**",
        "**/coverage/**",
        "**/*.log",
        "**/.env*",
      ],
    });

    const debounce = new Map<string, NodeJS.Timeout>();
    const schedule = (absPath: string) => {
      const rel = getRelPath(absPath);
      if (!rel) return;
      const t = debounce.get(rel);
      if (t) clearTimeout(t);
      debounce.set(
        rel,
        setTimeout(() => {
          debounce.delete(rel);
          runIncrementalForFile(rel).catch(() => {});
        }, 300)
      );
    };

    watcher.on("error", (err: unknown) => {
      console.warn("[diagnostics] watcher error:", err instanceof Error ? err.message : err);
    });
    watcher.on("change", schedule);
    watcher.on("add", schedule);
    watcher.on("unlink", (absPath) => {
      const rel = getRelPath(absPath);
      if (rel) {
        currentMap.delete(rel);
        sendToAll("diagnostics:update", serializeDiagnosticsMap(currentMap));
      }
    });
  });

  ipcMain.handle("diagnostics:runForFile", async (_e, root: string, relPath: string) => {
    if (currentRoot !== root) return;
    await runIncrementalForFile(relPath);
  });

  ipcMain.handle("diagnostics:restart", async () => {
    const root = currentRoot;
    if (!root) return;
    if (watcher) {
      watcher.close();
      watcher = null;
    }
    currentMap = new Map();
    sendToAll("diagnostics:update", []);
    currentRoot = root;
    if (scanPromise) await scanPromise;
    scanPromise = runFullScan(root);
    await scanPromise;
    scanPromise = null;
    watcher = chokidar.watch(root, {
      ignoreInitial: true,
      usePolling: true,
      interval: 2000,
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/.next/**",
        "**/.cache/**",
        "**/.turbo/**",
        "**/out/**",
        "**/.vite/**",
        "**/.viper/**",
        "**/.cursor/**",
        "**/coverage/**",
        "**/*.log",
        "**/.env*",
      ],
    });
    const debounce = new Map<string, NodeJS.Timeout>();
    const schedule = (absPath: string) => {
      const rel = getRelPath(absPath);
      if (!rel) return;
      const t = debounce.get(rel);
      if (t) clearTimeout(t);
      debounce.set(
        rel,
        setTimeout(() => {
          debounce.delete(rel);
          runIncrementalForFile(rel).catch(() => {});
        }, 300)
      );
    };
    watcher.on("error", (err: unknown) => {
      console.warn("[diagnostics] watcher error:", err instanceof Error ? err.message : err);
    });
    watcher.on("change", schedule);
    watcher.on("add", schedule);
    watcher.on("unlink", (absPath) => {
      const rel = getRelPath(absPath);
      if (rel) {
        currentMap.delete(rel);
        sendToAll("diagnostics:update", serializeDiagnosticsMap(currentMap));
      }
    });
  });
}
