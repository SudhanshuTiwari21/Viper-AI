"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTerminalService = setupTerminalService;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const node_child_process_1 = require("node:child_process");
const promises_1 = require("node:fs/promises");
let nextTermId = 1;
const ptyMap = new Map();
async function resolveValidCwd(workspaceRoot) {
    const fallbackCwd = process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
    const candidate = workspaceRoot && workspaceRoot.trim() !== "" ? workspaceRoot : fallbackCwd;
    try {
        const s = await (0, promises_1.stat)(candidate);
        if (s.isDirectory())
            return candidate;
    }
    catch { }
    return fallbackCwd;
}
function buildPtyEnv() {
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (typeof value === "string")
            env[key] = value;
    }
    if (!env.PATH || env.PATH.trim() === "") {
        env.PATH = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin";
    }
    env.TERM = env.TERM ?? "xterm-256color";
    return env;
}
async function spawnFallbackShell(shell, cwd, env) {
    return await new Promise((resolve, reject) => {
        const args = process.platform === "win32" ? [] : ["-i"];
        const proc = (0, node_child_process_1.spawn)(shell, args, {
            cwd,
            env,
            stdio: "pipe",
        });
        let settled = false;
        const onError = (err) => {
            if (settled)
                return;
            settled = true;
            reject(err);
        };
        const onSpawn = () => {
            if (settled)
                return;
            settled = true;
            proc.off("error", onError);
            resolve(proc);
        };
        proc.once("error", onError);
        proc.once("spawn", onSpawn);
    });
}
function setupTerminalService() {
    electron_1.ipcMain.handle("terminal:create", async (event, workspaceRoot) => {
        const termId = String(nextTermId++);
        let nodePty;
        try {
            nodePty = await Promise.resolve().then(() => __importStar(require("node-pty")));
        }
        catch (err) {
            console.error("terminal:create node-pty failed to load:", err);
            return { ok: false, error: "Terminal runtime failed to load. Try: npx electron-rebuild" };
        }
        const cwd = await resolveValidCwd(workspaceRoot);
        const env = buildPtyEnv();
        const shells = process.platform === "win32"
            ? [process.env.COMSPEC ?? "cmd.exe"]
            : [
                process.env.SHELL && path_1.default.isAbsolute(process.env.SHELL) ? process.env.SHELL : "",
                "/bin/zsh",
                "/bin/bash",
                "/bin/sh",
            ].filter(Boolean);
        let lastError = "No shell could be started";
        for (const shell of shells) {
            try {
                const pty = nodePty.spawn(shell, [], {
                    cwd,
                    env,
                    cols: 80,
                    rows: 24,
                });
                pty.onData((data) => {
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
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                lastError = msg;
                console.error("terminal:create failed for shell", shell, "cwd:", cwd, "error:", err);
            }
        }
        const fallbackShell = shells.find(Boolean) ?? (process.platform === "win32" ? "cmd.exe" : "/bin/sh");
        try {
            const proc = await spawnFallbackShell(fallbackShell, cwd, env);
            proc.stdout.on("data", (data) => {
                if (!event.sender.isDestroyed()) {
                    event.sender.send("terminal:data", { termId, data: data.toString() });
                }
            });
            proc.stderr.on("data", (data) => {
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
        }
        catch (fallbackErr) {
            const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            return { ok: false, error: `${lastError}; fallback failed: ${msg}` };
        }
    });
    electron_1.ipcMain.handle("terminal:write", (_event, termId, data) => {
        const entry = ptyMap.get(termId);
        if (entry?.pty)
            entry.pty.write(data);
        if (entry?.proc?.stdin.writable)
            entry.proc.stdin.write(data);
    });
    electron_1.ipcMain.handle("terminal:resize", (_event, termId, cols, rows) => {
        const entry = ptyMap.get(termId);
        if (entry?.pty) {
            const c = Math.max(1, Math.min(cols || 80, 500));
            const r = Math.max(1, Math.min(rows || 24, 200));
            entry.pty.resize(c, r);
        }
    });
    electron_1.ipcMain.handle("terminal:destroy", (_event, termId) => {
        const entry = ptyMap.get(termId);
        if (entry) {
            try {
                entry.pty?.kill();
                entry.proc?.kill("SIGTERM");
            }
            catch { }
            ptyMap.delete(termId);
        }
    });
    electron_1.ipcMain.handle("terminal:destroyAll", (event) => {
        const senderId = event.sender.id;
        for (const [termId, entry] of ptyMap) {
            if (entry.webContentsId === senderId) {
                try {
                    entry.pty?.kill();
                    entry.proc?.kill("SIGTERM");
                }
                catch { }
                ptyMap.delete(termId);
            }
        }
    });
}
