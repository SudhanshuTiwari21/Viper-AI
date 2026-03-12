"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const window_1 = require("./window");
const workspace_service_1 = require("../backend/workspace-service");
const file_service_1 = require("../backend/file-service");
const terminal_service_1 = require("../backend/terminal-service");
let mainWindow = null;
const isDev = process.env.NODE_ENV === "development" || !electron_1.app.isPackaged;
function init() {
    // Backend services: workspace, files, terminal.
    (0, workspace_service_1.setupWorkspaceService)();
    (0, file_service_1.setupFileService)();
    (0, terminal_service_1.setupTerminalService)();
    mainWindow = (0, window_1.createMainWindow)(isDev);
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(init);
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
    if (mainWindow === null) {
        init();
    }
});
