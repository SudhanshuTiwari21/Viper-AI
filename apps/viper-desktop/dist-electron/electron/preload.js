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
        write: (termId, data) => electron_1.ipcRenderer.invoke("terminal:write", termId, data),
        resize: (termId, cols, rows) => electron_1.ipcRenderer.invoke("terminal:resize", termId, cols, rows),
        destroy: (termId) => electron_1.ipcRenderer.invoke("terminal:destroy", termId),
        destroyAll: () => electron_1.ipcRenderer.invoke("terminal:destroyAll"),
        onData: (cb) => {
            const handler = (_e, payload) => cb(payload.termId, payload.data);
            electron_1.ipcRenderer.on("terminal:data", handler);
            return () => electron_1.ipcRenderer.removeListener("terminal:data", handler);
        },
        onExit: (cb) => {
            const handler = (_e, payload) => cb(payload.termId);
            electron_1.ipcRenderer.on("terminal:exit", handler);
            return () => electron_1.ipcRenderer.removeListener("terminal:exit", handler);
        },
    },
    git: {
        branch: (root) => electron_1.ipcRenderer.invoke("git:branch", root),
        log: (root, relPath) => electron_1.ipcRenderer.invoke("git:log", root, relPath),
        status: (root) => electron_1.ipcRenderer.invoke("git:status", root),
        diff: (root, filePath) => electron_1.ipcRenderer.invoke("git:diff", root, filePath),
        stage: (root, filePath) => electron_1.ipcRenderer.invoke("git:stage", root, filePath),
        unstage: (root, filePath) => electron_1.ipcRenderer.invoke("git:unstage", root, filePath),
        commit: (root, message) => electron_1.ipcRenderer.invoke("git:commit", root, message),
        discard: (root, filePath) => electron_1.ipcRenderer.invoke("git:discard", root, filePath),
    },
    shell: {
        revealInFolder: (workspaceRoot, relPath) => electron_1.ipcRenderer.invoke("shell:revealInFolder", workspaceRoot, relPath),
    },
    extensions: {
        scan: () => electron_1.ipcRenderer.invoke("extensions:scan"),
        activate: (id) => electron_1.ipcRenderer.invoke("extensions:activate", id),
        deactivate: (id) => electron_1.ipcRenderer.invoke("extensions:deactivate", id),
        setWorkspace: (root) => electron_1.ipcRenderer.invoke("extensions:setWorkspace", root),
        registry: {
            search: (query) => electron_1.ipcRenderer.invoke("extensions:registry:search", query),
            popular: () => electron_1.ipcRenderer.invoke("extensions:registry:popular"),
        },
        install: (id) => electron_1.ipcRenderer.invoke("extensions:install", id),
        uninstall: (id) => electron_1.ipcRenderer.invoke("extensions:uninstall", id),
        statusBar: {
            getItems: () => electron_1.ipcRenderer.invoke("extensions:statusBar:getItems"),
            onUpdate: (cb) => {
                const handler = (_e, items) => cb(items);
                electron_1.ipcRenderer.on("extensions:statusBar:update", handler);
                return () => electron_1.ipcRenderer.removeListener("extensions:statusBar:update", handler);
            },
        },
    },
    debug: {
        launch: (config) => electron_1.ipcRenderer.invoke("debug:launch", config),
        terminate: (sessionId) => electron_1.ipcRenderer.invoke("debug:terminate", sessionId),
        setBreakpoints: (file, lines) => electron_1.ipcRenderer.invoke("debug:setBreakpoints", file, lines),
        continue: (threadId) => electron_1.ipcRenderer.invoke("debug:continue", threadId),
        stepOver: (threadId) => electron_1.ipcRenderer.invoke("debug:stepOver", threadId),
        stepInto: (threadId) => electron_1.ipcRenderer.invoke("debug:stepInto", threadId),
        stepOut: (threadId) => electron_1.ipcRenderer.invoke("debug:stepOut", threadId),
        getStackTrace: (threadId) => electron_1.ipcRenderer.invoke("debug:getStackTrace", threadId),
        getScopes: (frameId) => electron_1.ipcRenderer.invoke("debug:getScopes", frameId),
        getVariables: (ref) => electron_1.ipcRenderer.invoke("debug:getVariables", ref),
        evaluate: (expression, frameId) => electron_1.ipcRenderer.invoke("debug:evaluate", expression, frameId),
        onEvent: (cb) => {
            const handler = (_e, event) => cb(event);
            electron_1.ipcRenderer.on("debug:event", handler);
            return () => electron_1.ipcRenderer.removeListener("debug:event", handler);
        },
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
