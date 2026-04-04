/**
 * Viper Extension Manifest — lives in each extension's package.json
 * under the "viper" key, or in a standalone viper-extension.json.
 */
export interface ExtensionManifest {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author?: string;
  icon?: string;
  main: string;
  activationEvents: string[];
  contributes?: ExtensionContributions;
}

export interface ExtensionContributions {
  commands?: ExtensionCommand[];
  languages?: ExtensionLanguage[];
  themes?: ExtensionTheme[];
  menus?: Record<string, ExtensionMenuItem[]>;
  statusBarItems?: StatusBarItemOptions[];
  treeViews?: { id: string; name: string }[];
}

export interface ExtensionCommand {
  command: string;
  title: string;
  icon?: string;
  category?: string;
}

export interface ExtensionLanguage {
  id: string;
  extensions: string[];
  aliases?: string[];
}

export interface ExtensionTheme {
  id: string;
  label: string;
  uiTheme: "vs-dark" | "vs-light";
  path: string;
}

export interface ExtensionMenuItem {
  command: string;
  when?: string;
  group?: string;
}

export interface StatusBarItemOptions {
  text: string;
  tooltip?: string;
  priority?: number;
  alignment?: "left" | "right";
  command?: string;
}

export interface StatusBarItem {
  id: string;
  update: (options: Partial<StatusBarItemOptions>) => void;
  show: () => void;
  hide: () => void;
  dispose: () => void;
}

export interface DecorationOptions {
  backgroundColor?: string;
  color?: string;
  border?: string;
  outline?: string;
  gutterIconPath?: string;
  overviewRulerColor?: string;
  isWholeLine?: boolean;
  after?: { contentText: string; color?: string };
  before?: { contentText: string; color?: string };
}

export interface DecorationType {
  id: string;
  options: DecorationOptions;
}

export interface DecorationRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface TreeDataProvider {
  getChildren: (element?: unknown) => Promise<TreeItem[]>;
  getTreeItem: (element: unknown) => TreeItem;
  onDidChangeTreeData?: (handler: () => void) => void;
}

export interface TreeItem {
  label: string;
  id?: string;
  description?: string;
  tooltip?: string;
  collapsibleState?: "collapsed" | "expanded" | "none";
  iconPath?: string;
  command?: { command: string; arguments?: unknown[] };
  contextValue?: string;
}

export interface WebviewPanel {
  id: string;
  title: string;
  setHtml: (html: string) => void;
  postMessage: (message: unknown) => void;
  onMessage: (handler: (message: unknown) => void) => void;
  dispose: () => void;
}

export type ExtensionStatus = "installed" | "active" | "disabled" | "error";

export interface ExtensionInfo {
  manifest: ExtensionManifest;
  status: ExtensionStatus;
  path: string;
  error?: string;
}

/**
 * The API surface exposed to extensions via `viper.extensions.getAPI()`.
 * This is intentionally minimal for the initial version.
 */
export interface ViperExtensionAPI {
  workspace: {
    rootPath: string | null;
    readFile: (relPath: string) => Promise<string>;
    writeFile: (relPath: string, content: string) => Promise<void>;
    listDirectory: (relPath: string) => Promise<string[]>;
  };
  editor: {
    openFile: (relPath: string) => void;
    getActiveFilePath: () => string | null;
  };
  commands: {
    registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => void;
    executeCommand: (id: string, ...args: unknown[]) => Promise<unknown>;
  };
  ui: {
    showNotification: (message: string, type?: "info" | "warning" | "error") => void;
    showQuickPick: (items: string[]) => Promise<string | undefined>;
  };
  events: {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    off: (event: string, handler: (...args: unknown[]) => void) => void;
    once: (event: string, handler: (...args: unknown[]) => void) => void;
  };
  statusBar: {
    createItem: (id: string, options: StatusBarItemOptions) => StatusBarItem;
  };
  decorations: {
    createDecorationType: (options: DecorationOptions) => DecorationType;
    setDecorations: (type: DecorationType, file: string, ranges: DecorationRange[]) => void;
    clearDecorations: (type: DecorationType) => void;
  };
  treeView: {
    registerProvider: (viewId: string, provider: TreeDataProvider) => void;
  };
  webview: {
    createPanel: (id: string, title: string, html: string) => WebviewPanel;
  };
}
