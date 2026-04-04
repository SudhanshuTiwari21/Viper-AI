import type { ExtensionInfo, StatusBarItemOptions } from "./types.js";
export declare class ExtensionHost {
    private userHome;
    private extensions;
    private commandHandlers;
    private workspaceRoot;
    private statusBarItems;
    private decorationTypes;
    private treeViewProviders;
    private webviewPanels;
    private nextDecorationId;
    onStatusBarChanged?: (items: Array<{
        id: string;
        options: StatusBarItemOptions;
        visible: boolean;
    }>) => void;
    constructor(userHome: string);
    get extensionsDir(): string;
    setWorkspaceRoot(root: string | null): void;
    scanExtensions(): Promise<ExtensionInfo[]>;
    private loadManifest;
    activateExtension(id: string): Promise<boolean>;
    deactivateExtension(id: string): Promise<void>;
    installExtension(id: string): Promise<boolean>;
    uninstallExtension(id: string): Promise<boolean>;
    registerCommand(id: string, handler: (...args: unknown[]) => unknown): void;
    executeCommand(id: string, ...args: unknown[]): Promise<unknown>;
    getExtensions(): ExtensionInfo[];
    getExtension(id: string): ExtensionInfo | undefined;
    getStatusBarItems(): Array<{
        id: string;
        options: StatusBarItemOptions;
        visible: boolean;
    }>;
    private notifyStatusBar;
    private buildAPI;
}
