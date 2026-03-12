"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupFileService = setupFileService;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const chokidar_1 = __importDefault(require("chokidar"));
const workspace_service_1 = require("./workspace-service");
function resolvePath(root, rel) {
    return path_1.default.isAbsolute(rel) ? rel : path_1.default.join(root, rel);
}
function setupFileService() {
    electron_1.ipcMain.handle("file:read", async (_e, root, rel) => {
        const full = resolvePath(root || workspace_service_1.WORKSPACES_ROOT, rel);
        return promises_1.default.readFile(full, "utf8");
    });
    electron_1.ipcMain.handle("file:write", async (_e, root, rel, content) => {
        const full = resolvePath(root || workspace_service_1.WORKSPACES_ROOT, rel);
        await promises_1.default.mkdir(path_1.default.dirname(full), { recursive: true });
        await promises_1.default.writeFile(full, content, "utf8");
    });
    electron_1.ipcMain.handle("file:create", async (_e, root, rel) => {
        const full = resolvePath(root || workspace_service_1.WORKSPACES_ROOT, rel);
        await promises_1.default.mkdir(path_1.default.dirname(full), { recursive: true });
        await promises_1.default.writeFile(full, "", "utf8");
    });
    electron_1.ipcMain.handle("file:delete", async (_e, root, rel) => {
        const full = resolvePath(root || workspace_service_1.WORKSPACES_ROOT, rel);
        await promises_1.default.rm(full, { recursive: true, force: true });
    });
    electron_1.ipcMain.handle("file:rename", async (_e, root, oldRel, newRel) => {
        const base = root || workspace_service_1.WORKSPACES_ROOT;
        const from = resolvePath(base, oldRel);
        const to = resolvePath(base, newRel);
        await promises_1.default.mkdir(path_1.default.dirname(to), { recursive: true });
        await promises_1.default.rename(from, to);
    });
    // File watcher: broadcast changes to renderer.
    const watcher = chokidar_1.default.watch(workspace_service_1.WORKSPACES_ROOT, {
        ignoreInitial: true,
        persistent: true,
    });
    const sendToAll = (channel, payload) => {
        electron_1.BrowserWindow.getAllWindows().forEach((w) => {
            w.webContents.send(channel, payload);
        });
    };
    watcher.on("change", (filePath) => {
        sendToAll("file:changed", { path: filePath });
    });
}
