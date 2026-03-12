"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("viper", {
    platform: process.platform,
    workspace: {
        list: () => electron_1.ipcRenderer.invoke("workspace:list"),
        select: () => electron_1.ipcRenderer.invoke("workspace:select"),
    },
    fs: {
        readFile: (root, rel) => electron_1.ipcRenderer.invoke("file:read", root, rel),
        writeFile: (root, rel, content) => electron_1.ipcRenderer.invoke("file:write", root, rel, content),
        createFile: (root, rel) => electron_1.ipcRenderer.invoke("file:create", root, rel),
        deletePath: (root, rel) => electron_1.ipcRenderer.invoke("file:delete", root, rel),
        renamePath: (root, oldRel, newRel) => electron_1.ipcRenderer.invoke("file:rename", root, oldRel, newRel),
        onFileChanged: (cb) => {
            electron_1.ipcRenderer.on("file:changed", (_e, payload) => cb(payload));
        },
    },
    terminal: {
        run: (root, command) => electron_1.ipcRenderer.invoke("terminal:run", root, command),
        onData: (cb) => {
            electron_1.ipcRenderer.on("terminal:data", (_e, payload) => cb(payload.data));
        },
    },
});
