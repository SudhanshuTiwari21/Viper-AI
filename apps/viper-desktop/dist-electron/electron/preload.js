"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("viper", {
    platform: process.platform,
    workspace: {
        list: (root) => electron_1.ipcRenderer.invoke("workspace:list", root),
        select: () => electron_1.ipcRenderer.invoke("workspace:select"),
        watch: (root) => electron_1.ipcRenderer.invoke("workspace:watch", root),
    },
    fs: {
        readFile: (root, rel) => electron_1.ipcRenderer.invoke("file:read", root, rel),
        writeFile: (root, rel, content) => electron_1.ipcRenderer.invoke("file:write", root, rel, content),
        createFile: (root, rel) => electron_1.ipcRenderer.invoke("file:create", root, rel),
        createFolder: (root, rel) => electron_1.ipcRenderer.invoke("file:createFolder", root, rel),
        deletePath: (root, rel) => electron_1.ipcRenderer.invoke("file:delete", root, rel),
        renamePath: (root, oldRel, newRel) => electron_1.ipcRenderer.invoke("file:rename", root, oldRel, newRel),
        onFileChanged: (cb) => {
            electron_1.ipcRenderer.on("file:changed", (_e, payload) => cb(payload));
        },
    },
    terminal: {
        create: (root) => electron_1.ipcRenderer.invoke("terminal:create", root),
        write: (data) => electron_1.ipcRenderer.invoke("terminal:write", data),
        resize: (cols, rows) => electron_1.ipcRenderer.invoke("terminal:resize", cols, rows),
        destroy: () => electron_1.ipcRenderer.invoke("terminal:destroy"),
        onData: (cb) => {
            electron_1.ipcRenderer.on("terminal:data", (_e, payload) => cb(payload.data));
        },
    },
    git: {
        branch: (root) => electron_1.ipcRenderer.invoke("git:branch", root),
        log: (root, relPath) => electron_1.ipcRenderer.invoke("git:log", root, relPath),
    },
    shell: {
        revealInFolder: (workspaceRoot, relPath) => electron_1.ipcRenderer.invoke("shell:revealInFolder", workspaceRoot, relPath),
    },
    diagnostics: {
        start: (root) => electron_1.ipcRenderer.invoke("diagnostics:start", root),
        runForFile: (root, relPath) => electron_1.ipcRenderer.invoke("diagnostics:runForFile", root, relPath),
        restart: () => electron_1.ipcRenderer.invoke("diagnostics:restart"),
        onUpdate: (cb) => {
            const handler = (_e, payload) => cb(payload);
            electron_1.ipcRenderer.on("diagnostics:update", handler);
            return () => electron_1.ipcRenderer.removeListener("diagnostics:update", handler);
        },
    },
});
// Translate main-process menu actions into browser events that the React app can listen for.
electron_1.ipcRenderer.on("viper:menu-open-folder", () => {
    window.dispatchEvent(new CustomEvent("viper:menu-open-folder"));
});
electron_1.ipcRenderer.on("viper:menu-save", () => {
    window.dispatchEvent(new CustomEvent("viper:menu-save"));
});
electron_1.ipcRenderer.on("viper:menu-save-all", () => {
    window.dispatchEvent(new CustomEvent("viper:menu-save-all"));
});
electron_1.ipcRenderer.on("viper:menu-toggle-panel", () => {
    window.dispatchEvent(new CustomEvent("viper:menu-toggle-panel"));
});
