"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDiagnosticsService = setupDiagnosticsService;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const chokidar_1 = __importDefault(require("chokidar"));
const electron_1 = require("electron");
const diagnostics_worker_1 = require("./diagnostics-worker");
let currentRoot = null;
let currentMap = new Map();
let watcher = null;
let scanPromise = null;
function sendToAll(channel, payload) {
    electron_1.BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed())
            w.webContents.send(channel, payload);
    });
}
function getRelPath(absPath) {
    if (!currentRoot)
        return null;
    const rel = path_1.default.relative(currentRoot, absPath);
    if (rel.startsWith("..") || path_1.default.isAbsolute(rel))
        return null;
    return path_1.default.sep === "\\" ? rel.replace(/\\/g, "/") : rel;
}
async function readFile(relPath) {
    if (!currentRoot)
        return "";
    return promises_1.default.readFile(path_1.default.join(currentRoot, relPath), "utf8");
}
async function runFullScan(rootDir) {
    try {
        const files = await (0, diagnostics_worker_1.collectFilePaths)(rootDir);
        const map = await (0, diagnostics_worker_1.runAnalyzers)(rootDir, files, readFile);
        currentMap = map;
        sendToAll("diagnostics:update", (0, diagnostics_worker_1.serializeDiagnosticsMap)(map));
    }
    catch (err) {
        console.error("[diagnostics] Full scan failed:", err);
        currentMap = new Map();
        sendToAll("diagnostics:update", []);
    }
}
async function runIncrementalForFile(relPath) {
    if (!currentRoot)
        return;
    try {
        const map = await (0, diagnostics_worker_1.runAnalyzers)(currentRoot, [relPath], readFile);
        const fileDiag = map.get(relPath) ?? [];
        if (fileDiag.length === 0) {
            currentMap.delete(relPath);
        }
        else {
            currentMap.set(relPath, fileDiag);
        }
        sendToAll("diagnostics:update", (0, diagnostics_worker_1.serializeDiagnosticsMap)(currentMap));
    }
    catch {
        // ignore per-file errors
    }
}
function setupDiagnosticsService() {
    electron_1.ipcMain.handle("diagnostics:start", async (_e, root) => {
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
        if (scanPromise)
            await scanPromise;
        scanPromise = runFullScan(root);
        await scanPromise;
        scanPromise = null;
        watcher = chokidar_1.default.watch(root, {
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
        const debounce = new Map();
        const schedule = (absPath) => {
            const rel = getRelPath(absPath);
            if (!rel)
                return;
            const t = debounce.get(rel);
            if (t)
                clearTimeout(t);
            debounce.set(rel, setTimeout(() => {
                debounce.delete(rel);
                runIncrementalForFile(rel).catch(() => { });
            }, 300));
        };
        watcher.on("error", (err) => {
            console.warn("[diagnostics] watcher error:", err instanceof Error ? err.message : err);
        });
        watcher.on("change", schedule);
        watcher.on("add", schedule);
        watcher.on("unlink", (absPath) => {
            const rel = getRelPath(absPath);
            if (rel) {
                currentMap.delete(rel);
                sendToAll("diagnostics:update", (0, diagnostics_worker_1.serializeDiagnosticsMap)(currentMap));
            }
        });
    });
    electron_1.ipcMain.handle("diagnostics:runForFile", async (_e, root, relPath) => {
        if (currentRoot !== root)
            return;
        await runIncrementalForFile(relPath);
    });
    electron_1.ipcMain.handle("diagnostics:restart", async () => {
        const root = currentRoot;
        if (!root)
            return;
        if (watcher) {
            watcher.close();
            watcher = null;
        }
        currentMap = new Map();
        sendToAll("diagnostics:update", []);
        currentRoot = root;
        if (scanPromise)
            await scanPromise;
        scanPromise = runFullScan(root);
        await scanPromise;
        scanPromise = null;
        watcher = chokidar_1.default.watch(root, {
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
        const debounce = new Map();
        const schedule = (absPath) => {
            const rel = getRelPath(absPath);
            if (!rel)
                return;
            const t = debounce.get(rel);
            if (t)
                clearTimeout(t);
            debounce.set(rel, setTimeout(() => {
                debounce.delete(rel);
                runIncrementalForFile(rel).catch(() => { });
            }, 300));
        };
        watcher.on("error", (err) => {
            console.warn("[diagnostics] watcher error:", err instanceof Error ? err.message : err);
        });
        watcher.on("change", schedule);
        watcher.on("add", schedule);
        watcher.on("unlink", (absPath) => {
            const rel = getRelPath(absPath);
            if (rel) {
                currentMap.delete(rel);
                sendToAll("diagnostics:update", (0, diagnostics_worker_1.serializeDiagnosticsMap)(currentMap));
            }
        });
    });
}
