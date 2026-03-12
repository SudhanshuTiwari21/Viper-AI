"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTerminalService = setupTerminalService;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const workspace_service_1 = require("./workspace-service");
function setupTerminalService() {
    electron_1.ipcMain.handle("terminal:run", (event, workspaceRoot, command) => {
        const root = workspaceRoot ?? workspace_service_1.WORKSPACES_ROOT;
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (!win)
            return;
        const shell = process.platform === "win32" ? process.env.COMSPEC ?? "cmd.exe" : process.env.SHELL ?? "/bin/bash";
        const child = (0, child_process_1.spawn)(shell, ["-lc", command], {
            cwd: root,
            env: process.env,
        });
        const channel = "terminal:data";
        child.stdout.on("data", (data) => {
            win.webContents.send(channel, { data: data.toString() });
        });
        child.stderr.on("data", (data) => {
            win.webContents.send(channel, { data: data.toString() });
        });
        child.on("close", (code) => {
            win.webContents.send(channel, { data: `\n[exit ${code}]\n` });
        });
    });
}
