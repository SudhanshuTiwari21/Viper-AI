interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface WorkspaceResult {
  root: string | null;
  tree: FileNode[];
}

interface GitFileStatus {
  status: string;
  file: string;
}

interface ViperTerminalApi {
  create: (root: string) => Promise<{ ok: boolean; termId?: string; error?: string }>;
  write: (termId: string, data: string) => Promise<void>;
  resize: (termId: string, cols: number, rows: number) => Promise<void>;
  destroy: (termId: string) => Promise<void>;
  destroyAll: () => Promise<void>;
  onData: (cb: (termId: string, data: string) => void) => (() => void) | void;
  onExit: (cb: (termId: string) => void) => (() => void) | void;
}

interface ViperGitApi {
  branch: (root: string) => Promise<string>;
  log: (root: string, relPath: string) => Promise<string[]>;
  status: (root: string) => Promise<GitFileStatus[]>;
  diff: (root: string, filePath?: string) => Promise<string>;
  stage: (root: string, filePath: string) => Promise<boolean>;
  unstage: (root: string, filePath: string) => Promise<boolean>;
  commit: (root: string, message: string) => Promise<boolean>;
  discard: (root: string, filePath: string) => Promise<boolean>;
}

interface ViperFsApi {
  readFile: (root: string, rel: string) => Promise<string>;
  writeFile: (root: string, rel: string, content: string) => Promise<void>;
  createFile: (root: string, rel: string) => Promise<void>;
  createFolder: (root: string, rel: string) => Promise<void>;
  deletePath: (root: string, rel: string) => Promise<void>;
  renamePath: (root: string, oldRel: string, newRel: string) => Promise<void>;
  onFileChanged: (cb: (payload: { path: string }) => void) => void;
}

interface ExtensionEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  status: string;
  error?: string;
}

interface RegistryEntry {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  tags: string[];
  repositoryUrl: string;
  packageUrl: string;
}

interface ViperExtensionRegistryApi {
  search: (query: string) => Promise<RegistryEntry[]>;
  popular: () => Promise<RegistryEntry[]>;
}

interface ViperExtensionStatusBarItem {
  id: string;
  options: { text: string; tooltip?: string; priority?: number; alignment?: "left" | "right"; command?: string };
  visible: boolean;
}

interface ViperExtensionStatusBarApi {
  getItems: () => Promise<ViperExtensionStatusBarItem[]>;
  onUpdate: (cb: (items: ViperExtensionStatusBarItem[]) => void) => () => void;
}

interface ViperExtensionsApi {
  scan: () => Promise<ExtensionEntry[]>;
  activate: (id: string) => Promise<boolean>;
  deactivate: (id: string) => Promise<boolean>;
  setWorkspace: (root: string | null) => Promise<void>;
  registry: ViperExtensionRegistryApi;
  install: (id: string) => Promise<boolean>;
  uninstall: (id: string) => Promise<boolean>;
  statusBar: ViperExtensionStatusBarApi;
}

interface DapLaunchConfiguration {
  name: string;
  type: "node" | "python" | "go";
  request: "launch" | "attach";
  program: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  port?: number;
  stopOnEntry?: boolean;
  console?: "internalConsole" | "integratedTerminal" | "externalTerminal";
}

interface DapBreakpoint {
  id: string;
  file: string;
  line: number;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
  verified: boolean;
}

interface DapStackFrame {
  id: number;
  name: string;
  source: { path: string; name: string };
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

interface DapVariable {
  name: string;
  value: string;
  type: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
}

interface DapScope {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

interface DapThread {
  id: number;
  name: string;
}

interface DapDebugSession {
  id: string;
  name: string;
  type: string;
  status: "running" | "stopped" | "terminated";
  threads: DapThread[];
  activeThreadId?: number;
  stoppedReason?: string;
}

type DapEvent =
  | { type: "stopped"; threadId: number; reason: string; allThreadsStopped?: boolean }
  | { type: "continued"; threadId: number; allThreadsContinued?: boolean }
  | { type: "exited"; exitCode: number }
  | { type: "terminated"; restart?: boolean }
  | { type: "output"; category: "stdout" | "stderr" | "console"; output: string }
  | { type: "breakpointChanged"; breakpoint: DapBreakpoint }
  | { type: "threadChanged"; reason: "started" | "exited"; threadId: number };

interface ViperDebugApi {
  launch: (config: DapLaunchConfiguration) => Promise<{ ok: boolean; sessionId?: string; session?: DapDebugSession; error?: string }>;
  terminate: (sessionId: string) => Promise<{ ok: boolean; error?: string }>;
  setBreakpoints: (file: string, lines: number[]) => Promise<{ ok: boolean; breakpoints?: DapBreakpoint[] }>;
  continue: (threadId: number) => Promise<{ ok: boolean }>;
  stepOver: (threadId: number) => Promise<{ ok: boolean }>;
  stepInto: (threadId: number) => Promise<{ ok: boolean }>;
  stepOut: (threadId: number) => Promise<{ ok: boolean }>;
  getStackTrace: (threadId: number) => Promise<DapStackFrame[]>;
  getScopes: (frameId: number) => Promise<DapScope[]>;
  getVariables: (ref: number) => Promise<DapVariable[]>;
  evaluate: (expression: string, frameId?: number) => Promise<{ ok: boolean; result?: string; error?: string }>;
  onEvent: (cb: (event: DapEvent) => void) => () => void;
}

interface ViperDiagnosticsApi {
  start: (root: string | null) => Promise<void>;
  runForFile: (root: string, relPath: string) => Promise<void>;
  restart: () => Promise<void>;
  onUpdate: (cb: (payload: Array<[string, unknown[]]>) => void) => () => void;
}

interface ViperApi {
  platform: string;
  workspace: {
    list: (root: string | null) => Promise<WorkspaceResult>;
    select: () => Promise<{ root: string; tree: unknown[] } | null>;
    watch: (root: string | null) => Promise<void>;
  };
  fs: ViperFsApi;
  terminal: ViperTerminalApi;
  git: ViperGitApi;
  shell: {
    revealInFolder: (workspaceRoot: string, relPath: string) => Promise<void>;
  };
  extensions: ViperExtensionsApi;
  debug: ViperDebugApi;
  diagnostics: ViperDiagnosticsApi;
}

declare global {
  interface Window {
    viper: ViperApi;
  }
}

export {};
