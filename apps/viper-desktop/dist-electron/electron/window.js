"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMainWindow = createMainWindow;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";
function createMainWindow(isDev) {
    const win = new electron_1.BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 900,
        minHeight: 600,
        title: "Viper AI",
        backgroundColor: "#0d0d0d",
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
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
    }
    else {
        win.loadFile(path_1.default.join(__dirname, "../dist/index.html"));
    }
    return win;
}
