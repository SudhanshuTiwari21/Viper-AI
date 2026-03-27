"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionHost = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const registry_js_1 = require("./registry.js");
const event_emitter_js_1 = require("./event-emitter.js");
const EXTENSIONS_DIR_NAME = ".viper-extensions";
class ExtensionHost {
    userHome;
    extensions = new Map();
    commandHandlers = new Map();
    workspaceRoot = null;
    statusBarItems = new Map();
    decorationTypes = new Map();
    treeViewProviders = new Map();
    webviewPanels = new Map();
    nextDecorationId = 0;
    onStatusBarChanged;
    constructor(userHome) {
        this.userHome = userHome;
    }
    get extensionsDir() {
        return (0, node_path_1.resolve)(this.userHome, EXTENSIONS_DIR_NAME);
    }
    setWorkspaceRoot(root) {
        this.workspaceRoot = root;
    }
    async scanExtensions() {
        const dir = this.extensionsDir;
        let entries;
        try {
            entries = await (0, promises_1.readdir)(dir);
        }
        catch {
            return [];
        }
        const results = [];
        for (const entry of entries) {
            const extPath = (0, node_path_1.join)(dir, entry);
            try {
                const s = await (0, promises_1.stat)(extPath);
                if (!s.isDirectory())
                    continue;
                const manifest = await this.loadManifest(extPath);
                if (!manifest)
                    continue;
                const info = {
                    manifest,
                    status: "installed",
                    path: extPath,
                };
                this.extensions.set(manifest.id, info);
                results.push(info);
            }
            catch {
                continue;
            }
        }
        return results;
    }
    async loadManifest(extPath) {
        for (const file of ["viper-extension.json", "package.json"]) {
            try {
                const raw = await (0, promises_1.readFile)((0, node_path_1.join)(extPath, file), "utf-8");
                const parsed = JSON.parse(raw);
                const manifest = file === "package.json"
                    ? parsed.viper ?? parsed
                    : parsed;
                if (manifest.id && manifest.name && manifest.main) {
                    return manifest;
                }
            }
            catch {
                continue;
            }
        }
        return null;
    }
    async activateExtension(id) {
        const info = this.extensions.get(id);
        if (!info)
            return false;
        try {
            const mainPath = (0, node_path_1.resolve)(info.path, info.manifest.main);
            const mod = await Promise.resolve(`${mainPath}`).then(s => __importStar(require(s)));
            if (typeof mod.activate === "function") {
                await mod.activate(this.buildAPI(id));
            }
            info.status = "active";
            if (info.manifest.contributes?.commands) {
                for (const cmd of info.manifest.contributes.commands) {
                    if (!this.commandHandlers.has(cmd.command)) {
                        this.commandHandlers.set(cmd.command, () => {
                            console.log(`[ExtHost] Unhandled command: ${cmd.command}`);
                        });
                    }
                }
            }
            return true;
        }
        catch (err) {
            info.status = "error";
            info.error = err instanceof Error ? err.message : String(err);
            return false;
        }
    }
    async deactivateExtension(id) {
        const info = this.extensions.get(id);
        if (!info || info.status !== "active")
            return;
        try {
            const mainPath = (0, node_path_1.resolve)(info.path, info.manifest.main);
            const mod = await Promise.resolve(`${mainPath}`).then(s => __importStar(require(s)));
            if (typeof mod.deactivate === "function") {
                await mod.deactivate();
            }
        }
        catch { }
        info.status = "installed";
    }
    async installExtension(id) {
        const entry = (0, registry_js_1.getRegistryEntry)(id);
        if (!entry)
            return false;
        const extDir = (0, node_path_1.join)(this.extensionsDir, id);
        try {
            await (0, promises_1.mkdir)(extDir, { recursive: true });
            const manifest = {
                id: entry.id,
                name: entry.name,
                displayName: entry.displayName,
                version: entry.version,
                description: entry.description,
                author: entry.author,
                main: "index.js",
                activationEvents: ["*"],
            };
            await (0, promises_1.writeFile)((0, node_path_1.join)(extDir, "viper-extension.json"), JSON.stringify(manifest, null, 2), "utf-8");
            const stub = [
                `"use strict";`,
                `exports.activate = function() { console.log("[${entry.displayName}] activated"); };`,
                `exports.deactivate = function() {};`,
            ].join("\n");
            await (0, promises_1.writeFile)((0, node_path_1.join)(extDir, "index.js"), stub, "utf-8");
            await this.scanExtensions();
            return true;
        }
        catch {
            return false;
        }
    }
    async uninstallExtension(id) {
        const extDir = (0, node_path_1.join)(this.extensionsDir, id);
        try {
            await (0, promises_1.rm)(extDir, { recursive: true, force: true });
            this.extensions.delete(id);
            return true;
        }
        catch {
            return false;
        }
    }
    registerCommand(id, handler) {
        this.commandHandlers.set(id, handler);
    }
    async executeCommand(id, ...args) {
        const handler = this.commandHandlers.get(id);
        if (!handler)
            throw new Error(`Unknown command: ${id}`);
        return handler(...args);
    }
    getExtensions() {
        return [...this.extensions.values()];
    }
    getExtension(id) {
        return this.extensions.get(id);
    }
    getStatusBarItems() {
        return [...this.statusBarItems.values()].map((item) => ({
            id: item.id,
            options: item.options,
            visible: item.visible,
        }));
    }
    notifyStatusBar() {
        this.onStatusBarChanged?.(this.getStatusBarItems());
    }
    buildAPI(extensionId) {
        const host = this;
        return {
            workspace: {
                get rootPath() { return host.workspaceRoot; },
                async readFile(relPath) {
                    if (!host.workspaceRoot)
                        throw new Error("No workspace open");
                    return (0, promises_1.readFile)((0, node_path_1.resolve)(host.workspaceRoot, relPath), "utf-8");
                },
                async writeFile(relPath, content) {
                    if (!host.workspaceRoot)
                        throw new Error("No workspace open");
                    await (0, promises_1.writeFile)((0, node_path_1.resolve)(host.workspaceRoot, relPath), content, "utf-8");
                },
                async listDirectory(relPath) {
                    if (!host.workspaceRoot)
                        throw new Error("No workspace open");
                    return (0, promises_1.readdir)((0, node_path_1.resolve)(host.workspaceRoot, relPath));
                },
            },
            editor: {
                openFile(_relPath) {
                    // Emitted to renderer via IPC
                },
                getActiveFilePath() {
                    return null;
                },
            },
            commands: {
                registerCommand(id, handler) {
                    host.registerCommand(`${extensionId}.${id}`, handler);
                },
                async executeCommand(id, ...args) {
                    return host.executeCommand(id, ...args);
                },
            },
            ui: {
                showNotification(message, _type) {
                    console.log(`[Extension ${extensionId}] Notification:`, message);
                },
                async showQuickPick(_items) {
                    return undefined;
                },
            },
            events: {
                on(event, handler) {
                    event_emitter_js_1.extensionEvents.on(event, handler);
                },
                off(event, handler) {
                    event_emitter_js_1.extensionEvents.off(event, handler);
                },
                once(event, handler) {
                    event_emitter_js_1.extensionEvents.once(event, handler);
                },
            },
            statusBar: {
                createItem: (id, options) => {
                    const qualifiedId = `${extensionId}.${id}`;
                    const entry = {
                        id: qualifiedId,
                        options: { ...options },
                        visible: true,
                        update(patch) {
                            Object.assign(entry.options, patch);
                            host.notifyStatusBar();
                        },
                        show() {
                            entry.visible = true;
                            host.notifyStatusBar();
                        },
                        hide() {
                            entry.visible = false;
                            host.notifyStatusBar();
                        },
                        dispose() {
                            host.statusBarItems.delete(qualifiedId);
                            host.notifyStatusBar();
                        },
                    };
                    host.statusBarItems.set(qualifiedId, entry);
                    host.notifyStatusBar();
                    return entry;
                },
            },
            decorations: {
                createDecorationType: (options) => {
                    const id = `${extensionId}.decoration-${host.nextDecorationId++}`;
                    host.decorationTypes.set(id, { type: options, decorations: new Map() });
                    return { id, options };
                },
                setDecorations(type, file, ranges) {
                    const entry = host.decorationTypes.get(type.id);
                    if (!entry)
                        return;
                    entry.decorations.set(file, ranges);
                },
                clearDecorations(type) {
                    const entry = host.decorationTypes.get(type.id);
                    if (!entry)
                        return;
                    entry.decorations.clear();
                },
            },
            treeView: {
                registerProvider(viewId, provider) {
                    host.treeViewProviders.set(`${extensionId}.${viewId}`, provider);
                },
            },
            webview: {
                createPanel: (id, title, html) => {
                    const qualifiedId = `${extensionId}.${id}`;
                    const messageHandlers = [];
                    const panel = {
                        id: qualifiedId,
                        title,
                        setHtml(newHtml) {
                            console.log(`[Webview ${qualifiedId}] setHtml (${newHtml.length} chars)`);
                        },
                        postMessage(message) {
                            console.log(`[Webview ${qualifiedId}] postMessage:`, message);
                        },
                        onMessage(handler) {
                            messageHandlers.push(handler);
                        },
                        dispose() {
                            host.webviewPanels.delete(qualifiedId);
                            messageHandlers.length = 0;
                        },
                    };
                    host.webviewPanels.set(qualifiedId, panel);
                    return panel;
                },
            },
        };
    }
}
exports.ExtensionHost = ExtensionHost;
