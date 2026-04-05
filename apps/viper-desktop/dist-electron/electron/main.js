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
/** One-time OAuth-style code from viper://auth/callback?code=… before any window is ready. */
let pendingAuthCode = null;
const isDev = process.env.NODE_ENV === "development" || !electron_1.app.isPackaged;
// Internal app name. In dev, Dock hover uses the launched .app bundle (see patch-electron-macos-branding.cjs:
// clones to Viper.app + unique CFBundleIdentifier so macOS does not keep showing "Electron").
if (process.platform === "darwin") {
    electron_1.app.setName("Viper");
}
function applyMacDockIcon() {
    if (process.platform !== "darwin" || !electron_1.app.dock)
        return;
    const iconPath = path_1.default.join(electron_1.app.getAppPath(), "resources", "icon.png");
    try {
        const image = electron_1.nativeImage.createFromPath(iconPath);
        if (!image.isEmpty()) {
            electron_1.app.dock.setIcon(image);
        }
    }
    catch {
        /* missing or unreadable icon */
    }
}
function parseViperAuthCallbackUrl(raw) {
    try {
        const u = new URL(raw);
        if (u.protocol !== "viper:")
            return null;
        if (u.hostname !== "auth")
            return null;
        if (u.pathname !== "/callback")
            return null;
        const code = u.searchParams.get("code");
        return code && code.length > 0 ? code.trim() : null;
    }
    catch {
        return null;
    }
}
function broadcastAuthHandoff(code) {
    for (const w of electron_1.BrowserWindow.getAllWindows()) {
        if (w.isDestroyed())
            continue;
        w.webContents.send("viper:auth-callback", { code });
    }
    const focused = electron_1.BrowserWindow.getFocusedWindow();
    if (focused && !focused.isDestroyed()) {
        focused.focus();
        return;
    }
    const fallback = mainWindow ?? electron_1.BrowserWindow.getAllWindows()[0];
    if (fallback && !fallback.isDestroyed())
        fallback.focus();
}
function handleAuthDeepLink(url) {
    const code = parseViperAuthCallbackUrl(url);
    if (!code)
        return;
    const wins = electron_1.BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) {
        pendingAuthCode = code;
        return;
    }
    broadcastAuthHandoff(code);
}
function flushPendingAuthCode() {
    if (!pendingAuthCode)
        return;
    const code = pendingAuthCode;
    pendingAuthCode = null;
    broadcastAuthHandoff(code);
}
function init() {
    applyMacDockIcon();
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
    try {
        const electronProcess = process;
        if (electronProcess.defaultApp && process.argv[1]) {
            electron_1.app.setAsDefaultProtocolClient("viper", process.execPath, [path_1.default.resolve(process.argv[1])]);
        }
        else {
            electron_1.app.setAsDefaultProtocolClient("viper");
        }
    }
    catch {
        /* protocol registration may fail in restricted environments */
    }
    mainWindow = (0, window_1.createMainWindow)(isDev);
    mainWindow.webContents.once("did-finish-load", () => {
        flushPendingAuthCode();
    });
    for (const arg of process.argv) {
        if (typeof arg === "string" && arg.startsWith("viper://")) {
            handleAuthDeepLink(arg);
        }
    }
    // macOS application menu – let Electron generate the standard app menu
    // (it will automatically use app.name, which we've set to "Viper").
    const macAppMenu = process.platform === "darwin" ? { role: "appMenu" } : undefined;
    // Application menu: VS Code–style, branded for Viper
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
                    label: "Viper Documentation",
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
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on("second-instance", (_e, argv) => {
        const url = argv.find((a) => typeof a === "string" && a.startsWith("viper://"));
        if (url)
            handleAuthDeepLink(url);
    });
    electron_1.app.on("open-url", (event, url) => {
        event.preventDefault();
        handleAuthDeepLink(url);
    });
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
}
