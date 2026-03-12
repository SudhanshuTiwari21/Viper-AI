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
const ptyMap = new Map();
function getPty(webContentsId) {
    return ptyMap.get(webContentsId)?.pty;
}
function setupTerminalService() {
    electron_1.ipcMain.handle("terminal:create", async (event, workspaceRoot) => {
        const id = event.sender.id;
        const existing = ptyMap.get(id);
        if (existing) {
            try {
                existing.pty.kill();
            }
            catch {
                // ignore
            }
            ptyMap.delete(id);
        }
        const nodePty = await Promise.resolve().then(() => __importStar(require("node-pty")));
        const fallbackCwd = process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
        const cwd = (workspaceRoot && workspaceRoot.trim() !== "") ? workspaceRoot : fallbackCwd;
        const shells = process.platform === "win32"
            ? [process.env.COMSPEC ?? "cmd.exe"]
            : [
                process.env.SHELL && path_1.default.isAbsolute(process.env.SHELL) ? process.env.SHELL : "",
                "/bin/zsh",
                "/bin/bash",
                "/bin/sh",
            ].filter(Boolean);
        for (const shell of shells) {
            try {
                const pty = nodePty.spawn(shell, [], {
                    cwd,
                    env: process.env,
                    cols: 80,
                    rows: 24,
                });
                pty.onData((data) => {
                    event.sender.send("terminal:data", { data });
                });
                pty.onExit(() => {
                    ptyMap.delete(id);
                });
                ptyMap.set(id, { pty });
                return { ok: true, shell };
            }
            catch (err) {
                console.error("terminal:create failed for shell", shell, err);
            }
        }
        console.error("terminal:create: all shell candidates failed");
        return { ok: false };
    });
    electron_1.ipcMain.handle("terminal:write", (event, data) => {
        const pty = getPty(event.sender.id);
        if (pty)
            pty.write(data);
    });
    electron_1.ipcMain.handle("terminal:resize", (event, cols, rows) => {
        const pty = getPty(event.sender.id);
        if (pty)
            pty.resize(cols, rows);
    });
    electron_1.ipcMain.handle("terminal:destroy", (event) => {
        const id = event.sender.id;
        const entry = ptyMap.get(id);
        if (entry) {
            try {
                entry.pty.kill();
            }
            catch {
                // ignore
            }
            ptyMap.delete(id);
        }
    });
}
