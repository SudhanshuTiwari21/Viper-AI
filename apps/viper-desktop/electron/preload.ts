import { contextBridge, ipcRenderer } from "electron";

// In the preload context TypeScript doesn't have DOM types, so declare window for typing only.
// At runtime this still runs in the renderer and window is available.
declare const window: any;

contextBridge.exposeInMainWorld("viper", {
  platform: process.platform,
  workspace: {
    list: (root: string | null) =>
      ipcRenderer.invoke("workspace:list", root) as Promise<{ root: string | null; tree: { name: string; path: string; isDirectory: boolean; children?: unknown[] }[] }>,
    select: () =>
      ipcRenderer.invoke("workspace:select") as Promise<{ root: string; tree: unknown[] } | null>,
    watch: (root: string | null) =>
      ipcRenderer.invoke("workspace:watch", root) as Promise<void>,
  },
  fs: {
    readFile: (root: string, rel: string) =>
      ipcRenderer.invoke("file:read", root, rel) as Promise<string>,
    writeFile: (root: string, rel: string, content: string) =>
      ipcRenderer.invoke("file:write", root, rel, content) as Promise<void>,
    createFile: (root: string, rel: string) =>
      ipcRenderer.invoke("file:create", root, rel) as Promise<void>,
    createFolder: (root: string, rel: string) =>
      ipcRenderer.invoke("file:createFolder", root, rel) as Promise<void>,
    deletePath: (root: string, rel: string) =>
      ipcRenderer.invoke("file:delete", root, rel) as Promise<void>,
    renamePath: (root: string, oldRel: string, newRel: string) =>
      ipcRenderer.invoke("file:rename", root, oldRel, newRel) as Promise<void>,
    onFileChanged: (cb: (payload: { path: string }) => void) => {
      ipcRenderer.on("file:changed", (_e, payload) => cb(payload));
    },
  },
  terminal: {
    create: (root: string) =>
      ipcRenderer.invoke("terminal:create", root) as Promise<{ ok: boolean }>,
    write: (data: string) => ipcRenderer.invoke("terminal:write", data),
    resize: (cols: number, rows: number) =>
      ipcRenderer.invoke("terminal:resize", cols, rows),
    destroy: () => ipcRenderer.invoke("terminal:destroy"),
    onData: (cb: (data: string) => void) => {
      ipcRenderer.on("terminal:data", (_e, payload: { data: string }) => cb(payload.data));
    },
  },
  git: {
    branch: (root: string) => ipcRenderer.invoke("git:branch", root) as Promise<string>,
    log: (root: string, relPath: string) =>
      ipcRenderer.invoke("git:log", root, relPath) as Promise<string[]>,
  },
  shell: {
    revealInFolder: (workspaceRoot: string, relPath: string) =>
      ipcRenderer.invoke("shell:revealInFolder", workspaceRoot, relPath) as Promise<void>,
  },
  diagnostics: {
    start: (root: string | null) => ipcRenderer.invoke("diagnostics:start", root) as Promise<void>,
    runForFile: (root: string, relPath: string) =>
      ipcRenderer.invoke("diagnostics:runForFile", root, relPath) as Promise<void>,
    restart: () => ipcRenderer.invoke("diagnostics:restart") as Promise<void>,
    onUpdate: (cb: (payload: Array<[string, unknown[]]>) => void) => {
      const handler = (_e: unknown, payload: Array<[string, unknown[]]>) => cb(payload);
      ipcRenderer.on("diagnostics:update", handler);
      return () => ipcRenderer.removeListener("diagnostics:update", handler);
    },
  },
});

// Translate main-process menu actions into browser events that the React app can listen for.
ipcRenderer.on("viper:menu-open-folder", () => {
  window.dispatchEvent(new CustomEvent("viper:menu-open-folder"));
});

ipcRenderer.on("viper:menu-save", () => {
  window.dispatchEvent(new CustomEvent("viper:menu-save"));
});

ipcRenderer.on("viper:menu-save-all", () => {
  window.dispatchEvent(new CustomEvent("viper:menu-save-all"));
});

ipcRenderer.on("viper:menu-toggle-panel", () => {
  window.dispatchEvent(new CustomEvent("viper:menu-toggle-panel"));
});
