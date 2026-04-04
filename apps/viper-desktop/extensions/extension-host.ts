import { readdir, readFile, stat, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import type {
  ExtensionManifest,
  ExtensionInfo,
  StatusBarItem,
  StatusBarItemOptions,
  DecorationOptions,
  DecorationType,
  DecorationRange,
  TreeDataProvider,
  WebviewPanel,
  ViperExtensionAPI,
} from "./types.js";
import { getRegistryEntry } from "./registry.js";
import { extensionEvents } from "./event-emitter.js";

const EXTENSIONS_DIR_NAME = ".viper-extensions";

export class ExtensionHost {
  private extensions: Map<string, ExtensionInfo> = new Map();
  private commandHandlers: Map<string, (...args: unknown[]) => unknown> = new Map();
  private workspaceRoot: string | null = null;

  private statusBarItems: Map<string, StatusBarItem & { options: StatusBarItemOptions; visible: boolean }> = new Map();
  private decorationTypes: Map<string, { type: DecorationOptions; decorations: Map<string, DecorationRange[]> }> = new Map();
  private treeViewProviders: Map<string, TreeDataProvider> = new Map();
  private webviewPanels: Map<string, WebviewPanel> = new Map();
  private nextDecorationId = 0;

  onStatusBarChanged?: (items: Array<{ id: string; options: StatusBarItemOptions; visible: boolean }>) => void;

  constructor(private userHome: string) {}

  get extensionsDir(): string {
    return resolve(this.userHome, EXTENSIONS_DIR_NAME);
  }

  setWorkspaceRoot(root: string | null) {
    this.workspaceRoot = root;
  }

  async scanExtensions(): Promise<ExtensionInfo[]> {
    const dir = this.extensionsDir;
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const results: ExtensionInfo[] = [];

    for (const entry of entries) {
      const extPath = join(dir, entry);
      try {
        const s = await stat(extPath);
        if (!s.isDirectory()) continue;

        const manifest = await this.loadManifest(extPath);
        if (!manifest) continue;

        const info: ExtensionInfo = {
          manifest,
          status: "installed",
          path: extPath,
        };

        this.extensions.set(manifest.id, info);
        results.push(info);
      } catch {
        continue;
      }
    }

    return results;
  }

  private async loadManifest(extPath: string): Promise<ExtensionManifest | null> {
    for (const file of ["viper-extension.json", "package.json"]) {
      try {
        const raw = await readFile(join(extPath, file), "utf-8");
        const parsed = JSON.parse(raw);
        const manifest: ExtensionManifest = file === "package.json"
          ? parsed.viper ?? parsed
          : parsed;

        if (manifest.id && manifest.name && manifest.main) {
          return manifest;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async activateExtension(id: string): Promise<boolean> {
    const info = this.extensions.get(id);
    if (!info) return false;

    try {
      const mainPath = resolve(info.path, info.manifest.main);
      const mod = await import(mainPath);
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
    } catch (err) {
      info.status = "error";
      info.error = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  async deactivateExtension(id: string): Promise<void> {
    const info = this.extensions.get(id);
    if (!info || info.status !== "active") return;

    try {
      const mainPath = resolve(info.path, info.manifest.main);
      const mod = await import(mainPath);
      if (typeof mod.deactivate === "function") {
        await mod.deactivate();
      }
    } catch {}

    info.status = "installed";
  }

  async installExtension(id: string): Promise<boolean> {
    const entry = getRegistryEntry(id);
    if (!entry) return false;

    const extDir = join(this.extensionsDir, id);
    try {
      await mkdir(extDir, { recursive: true });

      const manifest: ExtensionManifest = {
        id: entry.id,
        name: entry.name,
        displayName: entry.displayName,
        version: entry.version,
        description: entry.description,
        author: entry.author,
        main: "index.js",
        activationEvents: ["*"],
      };
      await writeFile(join(extDir, "viper-extension.json"), JSON.stringify(manifest, null, 2), "utf-8");

      const stub = [
        `"use strict";`,
        `exports.activate = function() { console.log("[${entry.displayName}] activated"); };`,
        `exports.deactivate = function() {};`,
      ].join("\n");
      await writeFile(join(extDir, "index.js"), stub, "utf-8");

      await this.scanExtensions();
      return true;
    } catch {
      return false;
    }
  }

  async uninstallExtension(id: string): Promise<boolean> {
    const extDir = join(this.extensionsDir, id);
    try {
      await rm(extDir, { recursive: true, force: true });
      this.extensions.delete(id);
      return true;
    } catch {
      return false;
    }
  }

  registerCommand(id: string, handler: (...args: unknown[]) => unknown) {
    this.commandHandlers.set(id, handler);
  }

  async executeCommand(id: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.commandHandlers.get(id);
    if (!handler) throw new Error(`Unknown command: ${id}`);
    return handler(...args);
  }

  getExtensions(): ExtensionInfo[] {
    return [...this.extensions.values()];
  }

  getExtension(id: string): ExtensionInfo | undefined {
    return this.extensions.get(id);
  }

  getStatusBarItems(): Array<{ id: string; options: StatusBarItemOptions; visible: boolean }> {
    return [...this.statusBarItems.values()].map((item) => ({
      id: item.id,
      options: item.options,
      visible: item.visible,
    }));
  }

  private notifyStatusBar() {
    this.onStatusBarChanged?.(this.getStatusBarItems());
  }

  private buildAPI(extensionId: string): ViperExtensionAPI {
    const host = this;
    return {
      workspace: {
        get rootPath() { return host.workspaceRoot; },
        async readFile(relPath: string) {
          if (!host.workspaceRoot) throw new Error("No workspace open");
          return readFile(resolve(host.workspaceRoot, relPath), "utf-8");
        },
        async writeFile(relPath: string, content: string) {
          if (!host.workspaceRoot) throw new Error("No workspace open");
          await writeFile(resolve(host.workspaceRoot, relPath), content, "utf-8");
        },
        async listDirectory(relPath: string) {
          if (!host.workspaceRoot) throw new Error("No workspace open");
          return readdir(resolve(host.workspaceRoot, relPath));
        },
      },
      editor: {
        openFile(_relPath: string) {
          // Emitted to renderer via IPC
        },
        getActiveFilePath() {
          return null;
        },
      },
      commands: {
        registerCommand(id: string, handler: (...args: unknown[]) => unknown) {
          host.registerCommand(`${extensionId}.${id}`, handler);
        },
        async executeCommand(id: string, ...args: unknown[]) {
          return host.executeCommand(id, ...args);
        },
      },
      ui: {
        showNotification(message: string, _type?: "info" | "warning" | "error") {
          console.log(`[Extension ${extensionId}] Notification:`, message);
        },
        async showQuickPick(_items: string[]) {
          return undefined;
        },
      },
      events: {
        on(event: string, handler: (...args: unknown[]) => void) {
          extensionEvents.on(event, handler);
        },
        off(event: string, handler: (...args: unknown[]) => void) {
          extensionEvents.off(event, handler);
        },
        once(event: string, handler: (...args: unknown[]) => void) {
          extensionEvents.once(event, handler);
        },
      },
      statusBar: {
        createItem: (id: string, options: StatusBarItemOptions): StatusBarItem => {
          const qualifiedId = `${extensionId}.${id}`;
          const entry = {
            id: qualifiedId,
            options: { ...options },
            visible: true,
            update(patch: Partial<StatusBarItemOptions>) {
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
        createDecorationType: (options: DecorationOptions): DecorationType => {
          const id = `${extensionId}.decoration-${host.nextDecorationId++}`;
          host.decorationTypes.set(id, { type: options, decorations: new Map() });
          return { id, options };
        },
        setDecorations(type: DecorationType, file: string, ranges: DecorationRange[]) {
          const entry = host.decorationTypes.get(type.id);
          if (!entry) return;
          entry.decorations.set(file, ranges);
        },
        clearDecorations(type: DecorationType) {
          const entry = host.decorationTypes.get(type.id);
          if (!entry) return;
          entry.decorations.clear();
        },
      },
      treeView: {
        registerProvider(viewId: string, provider: TreeDataProvider) {
          host.treeViewProviders.set(`${extensionId}.${viewId}`, provider);
        },
      },
      webview: {
        createPanel: (id: string, title: string, html: string): WebviewPanel => {
          const qualifiedId = `${extensionId}.${id}`;
          const messageHandlers: Array<(message: unknown) => void> = [];
          const panel: WebviewPanel = {
            id: qualifiedId,
            title,
            setHtml(newHtml: string) {
              console.log(`[Webview ${qualifiedId}] setHtml (${newHtml.length} chars)`);
            },
            postMessage(message: unknown) {
              console.log(`[Webview ${qualifiedId}] postMessage:`, message);
            },
            onMessage(handler: (message: unknown) => void) {
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
