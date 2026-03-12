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
exports.WORKSPACES_ROOT = path_1.default.join(process.env.HOME ?? process.env.USERPROFILE ?? electron_1.app.getPath("home"), ".viper", "workspaces");
async function readDirRecursive(root, dir) {
    const full = path_1.default.join(root, dir);
    const entries = await promises_1.default.readdir(full, { withFileTypes: true });
    const nodes = [];
    for (const entry of entries) {
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
    return nodes;
}
function setupWorkspaceService() {
    electron_1.ipcMain.handle("workspace:list", async () => {
        await promises_1.default.mkdir(exports.WORKSPACES_ROOT, { recursive: true });
        const roots = await readDirRecursive(exports.WORKSPACES_ROOT, ".");
        return { root: exports.WORKSPACES_ROOT, tree: roots };
    });
    electron_1.ipcMain.handle("workspace:select", async () => {
        const res = await electron_1.dialog.showOpenDialog({
            title: "Open workspace",
            defaultPath: exports.WORKSPACES_ROOT,
            properties: ["openDirectory"],
        });
        if (res.canceled || res.filePaths.length === 0)
            return null;
        const selected = res.filePaths[0];
        const tree = await readDirRecursive(selected, ".");
        return { root: selected, tree };
    });
}
