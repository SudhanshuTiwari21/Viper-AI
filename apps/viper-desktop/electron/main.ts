import path from "path";
import { app, BrowserWindow, Menu, shell, ipcMain, type MenuItemConstructorOptions } from "electron";
import { createMainWindow } from "./window";
import { setupWorkspaceService } from "../backend/workspace-service";
import { setupFileService } from "../backend/file-service";
import { setupTerminalService } from "../backend/terminal-service";
import { setupGitService } from "../backend/git-service";
import { setupDiagnosticsService } from "../diagnostics/diagnostics-service";

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// Ensure the macOS app name (menu bar, Cmd+Tab, etc.) says "Viper AI" instead of "Electron".
if (process.platform === "darwin") {
  app.setName("Viper AI");
}

function init(): void {
  // Backend services: workspace, files, terminal.
  setupWorkspaceService();
  setupFileService();
  setupTerminalService();
  setupGitService();
  setupDiagnosticsService();

  ipcMain.handle("shell:revealInFolder", (_e, workspaceRoot: string, relPath: string) => {
    const full = path.isAbsolute(relPath) ? relPath : path.join(workspaceRoot, relPath);
    shell.showItemInFolder(full);
  });

  mainWindow = createMainWindow(isDev);

  // macOS application menu – let Electron generate the standard app menu
  // (it will automatically use app.name, which we've set to "Viper AI").
  const macAppMenu: MenuItemConstructorOptions | undefined =
    process.platform === "darwin" ? { role: "appMenu" } : undefined;

   // Application menu: VS Code–style, branded for Viper AI
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
           label: "Viper AI Documentation",
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
