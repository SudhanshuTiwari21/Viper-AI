import path from "path";
import { app, BrowserWindow, Menu, shell, ipcMain, nativeImage, type MenuItemConstructorOptions } from "electron";
import { createMainWindow } from "./window";
import { setupWorkspaceService } from "../backend/workspace-service";
import { setupFileService } from "../backend/file-service";
import { setupTerminalService } from "../backend/terminal-service";
import { setupGitService } from "../backend/git-service";
import { setupDiagnosticsService } from "../diagnostics/diagnostics-service";
import { setupExtensionService } from "../backend/extension-service";
import { setupDebugService } from "../backend/debug-service";

let mainWindow: BrowserWindow | null = null;
/** One-time OAuth-style code from viper://auth/callback?code=… before any window is ready. */
let pendingAuthCode: string | null = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// Internal app name. In dev, Dock hover uses the launched .app bundle (see patch-electron-macos-branding.cjs:
// clones to Viper.app + unique CFBundleIdentifier so macOS does not keep showing "Electron").
if (process.platform === "darwin") {
  app.setName("Viper");
}

function applyMacDockIcon(): void {
  if (process.platform !== "darwin" || !app.dock) return;
  const iconPath = path.join(app.getAppPath(), "resources", "icon.png");
  try {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      app.dock.setIcon(image);
    }
  } catch {
    /* missing or unreadable icon */
  }
}

function parseViperAuthCallbackUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "viper:") return null;
    if (u.hostname !== "auth") return null;
    if (u.pathname !== "/callback") return null;
    const code = u.searchParams.get("code");
    return code && code.length > 0 ? code.trim() : null;
  } catch {
    return null;
  }
}

function broadcastAuthHandoff(code: string): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue;
    w.webContents.send("viper:auth-callback", { code });
  }
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) {
    focused.focus();
    return;
  }
  const fallback = mainWindow ?? BrowserWindow.getAllWindows()[0];
  if (fallback && !fallback.isDestroyed()) fallback.focus();
}

function handleAuthDeepLink(url: string): void {
  const code = parseViperAuthCallbackUrl(url);
  if (!code) return;
  const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  if (wins.length === 0) {
    pendingAuthCode = code;
    return;
  }
  broadcastAuthHandoff(code);
}

function flushPendingAuthCode(): void {
  if (!pendingAuthCode) return;
  const code = pendingAuthCode;
  pendingAuthCode = null;
  broadcastAuthHandoff(code);
}

function init(): void {
  applyMacDockIcon();

  // Backend services: workspace, files, terminal.
  setupWorkspaceService();
  setupFileService();
  setupTerminalService();
  setupGitService();
  setupDiagnosticsService();
  setupExtensionService();
  setupDebugService();

  ipcMain.handle("shell:revealInFolder", (_e, workspaceRoot: string, relPath: string) => {
    const full = path.isAbsolute(relPath) ? relPath : path.join(workspaceRoot, relPath);
    shell.showItemInFolder(full);
  });

  ipcMain.handle("shell:openExternal", (_e, url: string) => {
    if (typeof url !== "string" || !url.trim()) return;
    return shell.openExternal(url.trim());
  });

  try {
    const electronProcess = process as NodeJS.Process & { defaultApp?: boolean };
    if (electronProcess.defaultApp && process.argv[1]) {
      app.setAsDefaultProtocolClient("viper", process.execPath, [path.resolve(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient("viper");
    }
  } catch {
    /* protocol registration may fail in restricted environments */
  }

  mainWindow = createMainWindow(isDev);

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
  const macAppMenu: MenuItemConstructorOptions | undefined =
    process.platform === "darwin" ? { role: "appMenu" } : undefined;

   // Application menu: VS Code–style, branded for Viper
   const template: MenuItemConstructorOptions[] = [
     // macOS app menu
     ...(macAppMenu ? [macAppMenu] : []),
     {
       label: "File",
       submenu: [
         {
           label: "New Window",
           accelerator: "CmdOrCtrl+Shift+N",
           click: () => {
             createMainWindow(isDev);
           },
         },
         { type: "separator" },
         {
           label: "Open Folder…",
           accelerator: "CmdOrCtrl+O",
           click: () => {
             if (!mainWindow) return;
             mainWindow.webContents.send("viper:menu-open-folder");
           },
         },
         { type: "separator" },
         {
           label: "Save",
           accelerator: "CmdOrCtrl+S",
           click: () => {
             if (!mainWindow) return;
             mainWindow.webContents.send("viper:menu-save");
           },
         },
         {
           label: "Save All",
           accelerator: "CmdOrCtrl+Alt+S",
           click: () => {
             if (!mainWindow) return;
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
             if (!mainWindow) return;
             const modifiers = (process.platform === "darwin" ? ["meta"] : ["control"]) as ("meta" | "control")[];
             mainWindow.webContents.sendInputEvent({ type: "keyDown", keyCode: "z", modifiers });
             mainWindow.webContents.sendInputEvent({ type: "keyUp", keyCode: "z", modifiers });
           },
         },
         {
           label: "Redo",
           accelerator: process.platform === "darwin" ? "Shift+Cmd+Z" : "Ctrl+Y",
           click: () => {
             if (!mainWindow) return;
             if (process.platform === "darwin") {
               const modifiers = ["meta", "shift"] as ("meta" | "shift")[];
               mainWindow.webContents.sendInputEvent({ type: "keyDown", keyCode: "z", modifiers });
               mainWindow.webContents.sendInputEvent({ type: "keyUp", keyCode: "z", modifiers });
             } else {
               const modifiers = ["control"] as ("control")[];
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
            if (!mainWindow) return;
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
            if (!mainWindow) return;
            mainWindow.webContents.send("viper:focus-quick-open");
          },
        },
        {
          label: "Command Palette…",
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => {
            if (!mainWindow) return;
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
             if (!mainWindow) return;
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
             if (!mainWindow) return;
             mainWindow.webContents.send("viper:menu-new-terminal");
           },
         },
         {
           label: "Clear",
           accelerator: "CmdOrCtrl+K",
           click: () => {
             if (!mainWindow) return;
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
             if (!mainWindow) return;
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

   const menu = Menu.buildFromTemplate(template);
   Menu.setApplicationMenu(menu);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const url = argv.find((a) => typeof a === "string" && a.startsWith("viper://"));
    if (url) handleAuthDeepLink(url);
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleAuthDeepLink(url);
  });

  app.whenReady().then(init);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      init();
    }
  });
}
