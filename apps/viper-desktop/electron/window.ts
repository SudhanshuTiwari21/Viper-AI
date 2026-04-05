import { app, BrowserWindow, nativeImage } from "electron";
import path from "path";

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";

function mainWindowIcon(): Electron.NativeImage | undefined {
  const iconPath = path.join(app.getAppPath(), "resources", "icon.png");
  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? undefined : image;
}

export function createMainWindow(isDev: boolean): BrowserWindow {
  const icon = mainWindowIcon();
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 900,
    minHeight: 600,
    title: "Viper AI",
    backgroundColor: "#0d0d0d",
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Disable sandbox in dev to avoid issues with libraries like Monaco and
      // to make sure DevTools can attach reliably.
      sandbox: false,
    },
    show: false,
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  if (isDev && VITE_DEV_SERVER_URL.startsWith("http")) {
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open DevTools automatically in dev so you always see console errors.
    win.webContents.once("did-frame-finish-load", () => {
      win.webContents.openDevTools({ mode: "detach" });
    });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  return win;
}
