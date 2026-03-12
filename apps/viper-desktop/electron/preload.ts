import { contextBridge, ipcRenderer } from "electron";

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
});
