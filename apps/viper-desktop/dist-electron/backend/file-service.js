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
function resolvePath(root, rel) {
    return path_1.default.isAbsolute(rel) ? rel : path_1.default.join(root, rel);
}
let currentWatcher = null;
function sendToAll(channel, payload) {
    electron_1.BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send(channel, payload);
    });
}
function setupFileService() {
    electron_1.ipcMain.handle("file:read", async (_e, root, rel) => {
        const full = resolvePath(root, rel);
        return promises_1.default.readFile(full, "utf8");
    });
    electron_1.ipcMain.handle("file:write", async (_e, root, rel, content) => {
        const full = resolvePath(root, rel);
        await promises_1.default.mkdir(path_1.default.dirname(full), { recursive: true });
        await promises_1.default.writeFile(full, content, "utf8");
    });
    electron_1.ipcMain.handle("file:create", async (_e, root, rel) => {
        const full = resolvePath(root, rel);
        await promises_1.default.mkdir(path_1.default.dirname(full), { recursive: true });
        await promises_1.default.writeFile(full, "", "utf8");
    });
    electron_1.ipcMain.handle("file:createFolder", async (_e, root, rel) => {
        const full = resolvePath(root, rel);
        await promises_1.default.mkdir(full, { recursive: true });
    });
    electron_1.ipcMain.handle("file:delete", async (_e, root, rel) => {
        const full = resolvePath(root, rel);
        await promises_1.default.rm(full, { recursive: true, force: true });
    });
    electron_1.ipcMain.handle("file:rename", async (_e, root, oldRel, newRel) => {
        const from = resolvePath(root, oldRel);
        const to = resolvePath(root, newRel);
        await promises_1.default.mkdir(path_1.default.dirname(to), { recursive: true });
        await promises_1.default.rename(from, to);
    });
    electron_1.ipcMain.handle("workspace:watch", async (_e, root) => {
        if (currentWatcher) {
            currentWatcher.close();
            currentWatcher = null;
        }
        if (!root)
            return;
        currentWatcher = chokidar_1.default.watch(root, {
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
        const notify = (filePath) => {
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
