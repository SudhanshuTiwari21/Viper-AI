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
      ipcRenderer.invoke("terminal:create", root) as Promise<{ ok: boolean; termId?: string; error?: string }>,
    write: (termId: string, data: string) => ipcRenderer.invoke("terminal:write", termId, data),
    resize: (termId: string, cols: number, rows: number) =>
      ipcRenderer.invoke("terminal:resize", termId, cols, rows),
    destroy: (termId: string) => ipcRenderer.invoke("terminal:destroy", termId),
    destroyAll: () => ipcRenderer.invoke("terminal:destroyAll"),
    onData: (cb: (termId: string, data: string) => void) => {
      const handler = (_e: unknown, payload: { termId: string; data: string }) =>
        cb(payload.termId, payload.data);
      ipcRenderer.on("terminal:data", handler);
      return () => ipcRenderer.removeListener("terminal:data", handler);
    },
    onExit: (cb: (termId: string) => void) => {
      const handler = (_e: unknown, payload: { termId: string }) => cb(payload.termId);
      ipcRenderer.on("terminal:exit", handler);
      return () => ipcRenderer.removeListener("terminal:exit", handler);
    },
  },
  git: {
    branch: (root: string) => ipcRenderer.invoke("git:branch", root) as Promise<string>,
    log: (root: string, relPath: string) =>
      ipcRenderer.invoke("git:log", root, relPath) as Promise<string[]>,
    status: (root: string) =>
      ipcRenderer.invoke("git:status", root) as Promise<Array<{ status: string; file: string }>>,
    diff: (root: string, filePath?: string) =>
      ipcRenderer.invoke("git:diff", root, filePath) as Promise<string>,
    stage: (root: string, filePath: string) =>
      ipcRenderer.invoke("git:stage", root, filePath) as Promise<boolean>,
    unstage: (root: string, filePath: string) =>
      ipcRenderer.invoke("git:unstage", root, filePath) as Promise<boolean>,
    commit: (root: string, message: string) =>
      ipcRenderer.invoke("git:commit", root, message) as Promise<boolean>,
    discard: (root: string, filePath: string) =>
      ipcRenderer.invoke("git:discard", root, filePath) as Promise<boolean>,
  },
  shell: {
    revealInFolder: (workspaceRoot: string, relPath: string) =>
      ipcRenderer.invoke("shell:revealInFolder", workspaceRoot, relPath) as Promise<void>,
  },
  extensions: {
    scan: () =>
      ipcRenderer.invoke("extensions:scan") as Promise<Array<{
        id: string; name: string; version: string; description: string;
        author?: string; status: string; error?: string;
      }>>,
    activate: (id: string) =>
      ipcRenderer.invoke("extensions:activate", id) as Promise<boolean>,
    deactivate: (id: string) =>
      ipcRenderer.invoke("extensions:deactivate", id) as Promise<boolean>,
    setWorkspace: (root: string | null) =>
      ipcRenderer.invoke("extensions:setWorkspace", root) as Promise<void>,
    registry: {
      search: (query: string) =>
        ipcRenderer.invoke("extensions:registry:search", query),
      popular: () =>
        ipcRenderer.invoke("extensions:registry:popular"),
    },
    install: (id: string) =>
      ipcRenderer.invoke("extensions:install", id) as Promise<boolean>,
    uninstall: (id: string) =>
      ipcRenderer.invoke("extensions:uninstall", id) as Promise<boolean>,
    statusBar: {
      getItems: () =>
        ipcRenderer.invoke("extensions:statusBar:getItems") as Promise<Array<{
          id: string; options: { text: string; tooltip?: string; priority?: number; alignment?: "left" | "right"; command?: string }; visible: boolean;
        }>>,
      onUpdate: (cb: (items: Array<{
        id: string; options: { text: string; tooltip?: string; priority?: number; alignment?: "left" | "right"; command?: string }; visible: boolean;
      }>) => void) => {
        const handler = (_e: unknown, items: Array<{
          id: string; options: { text: string; tooltip?: string; priority?: number; alignment?: "left" | "right"; command?: string }; visible: boolean;
        }>) => cb(items);
        ipcRenderer.on("extensions:statusBar:update", handler);
        return () => ipcRenderer.removeListener("extensions:statusBar:update", handler);
      },
    },
  },
  debug: {
    launch: (config: unknown) =>
      ipcRenderer.invoke("debug:launch", config),
    terminate: (sessionId: string) =>
      ipcRenderer.invoke("debug:terminate", sessionId),
    setBreakpoints: (file: string, lines: number[]) =>
      ipcRenderer.invoke("debug:setBreakpoints", file, lines),
    continue: (threadId: number) =>
      ipcRenderer.invoke("debug:continue", threadId),
    stepOver: (threadId: number) =>
      ipcRenderer.invoke("debug:stepOver", threadId),
    stepInto: (threadId: number) =>
      ipcRenderer.invoke("debug:stepInto", threadId),
    stepOut: (threadId: number) =>
      ipcRenderer.invoke("debug:stepOut", threadId),
    getStackTrace: (threadId: number) =>
      ipcRenderer.invoke("debug:getStackTrace", threadId),
    getScopes: (frameId: number) =>
      ipcRenderer.invoke("debug:getScopes", frameId),
    getVariables: (ref: number) =>
      ipcRenderer.invoke("debug:getVariables", ref),
    evaluate: (expression: string, frameId?: number) =>
      ipcRenderer.invoke("debug:evaluate", expression, frameId),
    onEvent: (cb: (event: unknown) => void) => {
      const handler = (_e: unknown, event: unknown) => cb(event);
      ipcRenderer.on("debug:event", handler);
      return () => ipcRenderer.removeListener("debug:event", handler);
    },
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
