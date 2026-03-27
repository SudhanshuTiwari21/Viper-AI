import { ipcMain, BrowserWindow } from "electron";
import { homedir } from "node:os";
import { ExtensionHost } from "../extensions/extension-host.js";
import { searchRegistry, getPopularExtensions } from "../extensions/registry.js";

let extensionHost: ExtensionHost | null = null;

function getHost(): ExtensionHost {
  if (!extensionHost) {
    extensionHost = new ExtensionHost(homedir());
  }
  return extensionHost;
}

export function setupExtensionService() {
  ipcMain.handle("extensions:scan", async () => {
    try {
      const exts = await getHost().scanExtensions();
      return exts.map((e) => ({
        id: e.manifest.id,
        name: e.manifest.displayName || e.manifest.name,
        version: e.manifest.version,
        description: e.manifest.description,
        author: e.manifest.author,
        status: e.status,
        error: e.error,
      }));
    } catch {
      return [];
    }
  });

  ipcMain.handle("extensions:activate", async (_e, id: string) => {
    try {
      return await getHost().activateExtension(id);
    } catch {
      return false;
    }
  });

  ipcMain.handle("extensions:deactivate", async (_e, id: string) => {
    try {
      await getHost().deactivateExtension(id);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("extensions:setWorkspace", async (_e, root: string | null) => {
    getHost().setWorkspaceRoot(root);
  });

  ipcMain.handle("extensions:registry:search", async (_e, query: string) => {
    return searchRegistry(query);
  });

  ipcMain.handle("extensions:registry:popular", async () => {
    return getPopularExtensions();
  });

  ipcMain.handle("extensions:install", async (_e, id: string) => {
    try {
      return await getHost().installExtension(id);
    } catch {
      return false;
    }
  });

  ipcMain.handle("extensions:uninstall", async (_e, id: string) => {
    try {
      return await getHost().uninstallExtension(id);
    } catch {
      return false;
    }
  });

  ipcMain.handle("extensions:statusBar:getItems", () => {
    return getHost().getStatusBarItems();
  });

  getHost().onStatusBarChanged = (items) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("extensions:statusBar:update", items);
    }
  };
}
