"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACES_ROOT = void 0;
exports.setupWorkspaceService = setupWorkspaceService;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const electron_1 = require("electron");
const IGNORED_DIRS = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    ".viper",
]);
exports.WORKSPACES_ROOT = path_1.default.join(process.env.HOME ?? process.env.USERPROFILE ?? electron_1.app.getPath("home"), ".viper", "workspaces");
async function readDirRecursive(root, dir) {
    const full = path_1.default.join(root, dir);
    let entries;
    try {
        entries = await promises_1.default.readdir(full, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const nodes = [];
    for (const entry of entries) {
        if (entry.isDirectory() && IGNORED_DIRS.has(entry.name))
            continue;
        const rel = path_1.default.join(dir, entry.name);
        const node = {
            name: entry.name,
            path: rel,
            isDirectory: entry.isDirectory(),
        };
        if (entry.isDirectory()) {
            node.children = await readDirRecursive(root, rel);
        }
        nodes.push(node);
    }
    return nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory)
            return -1;
        if (!a.isDirectory && b.isDirectory)
            return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}
function setupWorkspaceService() {
    electron_1.ipcMain.handle("workspace:list", async (_e, root) => {
        if (!root)
            return { root: null, tree: [] };
        const tree = await readDirRecursive(root, ".");
        return { root, tree };
    });
    electron_1.ipcMain.handle("workspace:select", async () => {
        const home = electron_1.app.getPath("home");
        const res = await electron_1.dialog.showOpenDialog({
            title: "Open Folder",
            defaultPath: home,
            properties: ["openDirectory"],
        });
        if (res.canceled || res.filePaths.length === 0)
            return null;
        const selected = res.filePaths[0];
        const tree = await readDirRecursive(selected, ".");
        return { root: selected, tree };
    });
}
