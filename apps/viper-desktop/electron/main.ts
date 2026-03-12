import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./window";
import { setupWorkspaceService } from "../backend/workspace-service";
import { setupFileService } from "../backend/file-service";
import { setupTerminalService } from "../backend/terminal-service";

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

function init(): void {
  // Backend services: workspace, files, terminal.
  setupWorkspaceService();
  setupFileService();
  setupTerminalService();

  mainWindow = createMainWindow(isDev);

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
