"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupExtensionService = setupExtensionService;
const electron_1 = require("electron");
const node_os_1 = require("node:os");
const extension_host_js_1 = require("../extensions/extension-host.js");
const registry_js_1 = require("../extensions/registry.js");
let extensionHost = null;
function getHost() {
    if (!extensionHost) {
        extensionHost = new extension_host_js_1.ExtensionHost((0, node_os_1.homedir)());
    }
    return extensionHost;
}
function setupExtensionService() {
    electron_1.ipcMain.handle("extensions:scan", async () => {
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
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle("extensions:activate", async (_e, id) => {
        try {
            return await getHost().activateExtension(id);
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.handle("extensions:deactivate", async (_e, id) => {
        try {
            await getHost().deactivateExtension(id);
            return true;
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.handle("extensions:setWorkspace", async (_e, root) => {
        getHost().setWorkspaceRoot(root);
    });
    electron_1.ipcMain.handle("extensions:registry:search", async (_e, query) => {
        return (0, registry_js_1.searchRegistry)(query);
    });
    electron_1.ipcMain.handle("extensions:registry:popular", async () => {
        return (0, registry_js_1.getPopularExtensions)();
    });
    electron_1.ipcMain.handle("extensions:install", async (_e, id) => {
        try {
            return await getHost().installExtension(id);
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.handle("extensions:uninstall", async (_e, id) => {
        try {
            return await getHost().uninstallExtension(id);
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.handle("extensions:statusBar:getItems", () => {
        return getHost().getStatusBarItems();
    });
    getHost().onStatusBarChanged = (items) => {
        for (const win of electron_1.BrowserWindow.getAllWindows()) {
            win.webContents.send("extensions:statusBar:update", items);
        }
    };
}
