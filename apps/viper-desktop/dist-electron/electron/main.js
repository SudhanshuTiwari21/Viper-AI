"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const window_1 = require("./window");
const workspace_service_1 = require("../backend/workspace-service");
const file_service_1 = require("../backend/file-service");
const terminal_service_1 = require("../backend/terminal-service");
const git_service_1 = require("../backend/git-service");
const diagnostics_service_1 = require("../diagnostics/diagnostics-service");
const extension_service_1 = require("../backend/extension-service");
const debug_service_1 = require("../backend/debug-service");
let mainWindow = null;
const isDev = process.env.NODE_ENV === "development" || !electron_1.app.isPackaged;
// Ensure the macOS app name (menu bar, Cmd+Tab, etc.) says "Viper AI" instead of "Electron".
if (process.platform === "darwin") {
    electron_1.app.setName("Viper AI");
}
function init() {
    // Backend services: workspace, files, terminal.
    (0, workspace_service_1.setupWorkspaceService)();
    (0, file_service_1.setupFileService)();
    (0, terminal_service_1.setupTerminalService)();
    (0, git_service_1.setupGitService)();
    (0, diagnostics_service_1.setupDiagnosticsService)();
    (0, extension_service_1.setupExtensionService)();
    (0, debug_service_1.setupDebugService)();
    electron_1.ipcMain.handle("shell:revealInFolder", (_e, workspaceRoot, relPath) => {
        const full = path_1.default.isAbsolute(relPath) ? relPath : path_1.default.join(workspaceRoot, relPath);
        electron_1.shell.showItemInFolder(full);
    });
    electron_1.ipcMain.handle("shell:openExternal", (_e, url) => {
        if (typeof url !== "string" || !url.trim())
            return;
        return electron_1.shell.openExternal(url.trim());
    });
    mainWindow = (0, window_1.createMainWindow)(isDev);
    // macOS application menu – let Electron generate the standard app menu
    // (it will automatically use app.name, which we've set to "Viper AI").
    const macAppMenu = process.platform === "darwin" ? { role: "appMenu" } : undefined;
    // Application menu: VS Code–style, branded for Viper AI
    const template = [
        // macOS app menu
        ...(macAppMenu ? [macAppMenu] : []),
        {
            label: "File",
            submenu: [
                {
                    label: "New Window",
                    accelerator: "CmdOrCtrl+Shift+N",
                    click: () => {
                        (0, window_1.createMainWindow)(isDev);
                    },
                },
                { type: "separator" },
                {
                    label: "Open Folder…",
                    accelerator: "CmdOrCtrl+O",
                    click: () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send("viper:menu-open-folder");
                    },
                },
                { type: "separator" },
                {
                    label: "Save",
                    accelerator: "CmdOrCtrl+S",
                    click: () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send("viper:menu-save");
                    },
                },
                {
                    label: "Save All",
                    accelerator: "CmdOrCtrl+Alt+S",
                    click: () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send("viper:menu-save-all");
                    },
                },
                { type: "separator" },
                process.platform === "darwin" ? { role: "close" } : { role: "quit" },
            ],
        },
        {
            label: "Edit",
            submenu: [
                {
                    label: "Undo",
                    accelerator: "CmdOrCtrl+Z",
                    click: () => {
                        if (!mainWindow)
                            return;
                        const modifiers = (process.platform === "darwin" ? ["meta"] : ["control"]);
                        mainWindow.webContents.sendInputEvent({ type: "keyDown", keyCode: "z", modifiers });
                        mainWindow.webContents.sendInputEvent({ type: "keyUp", keyCode: "z", modifiers });
                    },
                },
                {
                    label: "Redo",
                    accelerator: process.platform === "darwin" ? "Shift+Cmd+Z" : "Ctrl+Y",
                    click: () => {
                        if (!mainWindow)
                            return;
                        if (process.platform === "darwin") {
                            const modifiers = ["meta", "shift"];
                            mainWindow.webContents.sendInputEvent({ type: "keyDown", keyCode: "z", modifiers });
                            mainWindow.webContents.sendInputEvent({ type: "keyUp", keyCode: "z", modifiers });
                        }
                        else {
                            const modifiers = ["control"];
                            mainWindow.webContents.sendInputEvent({ type: "keyDown", keyCode: "y", modifiers });
                            mainWindow.webContents.sendInputEvent({ type: "keyUp", keyCode: "y", modifiers });
                        }
                    },
                },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "selectAll" },
            ],
        },
        {
            label: "Selection",
            submenu: [
                {
                    label: "Select All",
                    accelerator: "CmdOrCtrl+A",
                    role: "selectAll",
                },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
                { type: "separator" },
                {
                    label: "Toggle Terminal",
                    accelerator: "CmdOrCtrl+Shift+`",
                    click: () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send("viper:menu-toggle-panel");
                    },
                },
            ],
        },
        {
            label: "Go",
            submenu: [
                {
                    label: "Go to File…",
                    accelerator: "CmdOrCtrl+P",
                    click: () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send("viper:focus-quick-open");
                    },
                },
                {
                    label: "Command Palette…",
                    accelerator: "CmdOrCtrl+Shift+P",
                    click: () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send("viper:open-command-palette");
                    },
                },
            ],
        },
        {
            label: "Run",
            submenu: [
                {
                    label: "Run Task…",
                    accelerator: "CmdOrCtrl+Shift+B",
                    click: () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send("viper:menu-run-task");
                    },
                },
            ],
        },
        {
            label: "Terminal",
            submenu: [
                {
                    label: "New Terminal",
                    accelerator: "CmdOrCtrl+Shift+`",
                    click: () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send("viper:menu-new-terminal");
                    },
                },
                {
                    label: "Clear",
                    accelerator: "CmdOrCtrl+K",
                    click: () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send("viper:menu-clear-terminal");
                    },
                },
            ],
        },
        {
            label: "Help",
            submenu: [
                {
                    label: "Viper AI Documentation",
                    click: () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send("viper:menu-open-docs");
                    },
                },
                { type: "separator" },
                {
                    label: "Toggle Developer Tools",
                    accelerator: process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
                    role: "toggleDevTools",
                },
            ],
        },
    ];
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
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
