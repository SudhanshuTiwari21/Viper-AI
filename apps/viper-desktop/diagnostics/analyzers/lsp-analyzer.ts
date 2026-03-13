import path from "path";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { createMessageConnection, type MessageConnection } from "vscode-jsonrpc";
import { StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node";
import { pathToFileURL } from "url";
import fs from "fs/promises";
import type { Diagnostic } from "../types";

type LspServerId = "tsserver" | "pyright" | "gopls" | "rust-analyzer";

interface LspServerConfig {
  id: LspServerId;
  command: string;
  args: string[];
  /** Extensions this server should handle (without dot, lowercased). */
  exts: string[];
  /** Detection files that must exist in workspace to start this server. */
  requires: string[];
}

const SERVER_CONFIGS: LspServerConfig[] = [
  {
    id: "tsserver",
    command: "typescript-language-server",
    args: ["--stdio"],
    exts: ["ts", "tsx", "js", "jsx", "mjs", "cjs"],
    requires: ["tsconfig.json", "jsconfig.json", "package.json"],
  },
  {
    id: "pyright",
    command: "pyright-langserver",
    args: ["--stdio"],
    exts: ["py"],
    requires: ["pyproject.toml", "pyrightconfig.json"],
  },
  {
    id: "gopls",
    command: "gopls",
    args: [],
    exts: ["go"],
    requires: ["go.mod"],
  },
  {
    id: "rust-analyzer",
    command: "rust-analyzer",
    args: [],
    exts: ["rs"],
    requires: ["Cargo.toml"],
  },
];

interface FileDiagnostics {
  [filePath: string]: Diagnostic[];
}

interface RunningServer {
  config: LspServerConfig;
  process: ChildProcessWithoutNullStreams;
  connection: MessageConnection;
  initialized: boolean;
  /** Workspace root directory this server was started in. */
  rootDir: string;
  /** Latest diagnostics per file (workspace-relative path). */
  diagnostics: FileDiagnostics;
  /** Pending resolvers waiting for diagnostics for a given file URI. */
  pending: Map<string, (diags: Diagnostic[]) => void>;
}

const serversByRoot = new Map<
  string,
  {
    servers: Map<LspServerId, RunningServer>;
  }
>();

async function fileExists(rootDir: string, rel: string): Promise<boolean> {
  try {
    await fs.access(path.join(rootDir, rel));
    return true;
  } catch {
    return false;
  }
}

async function detectLanguageServers(rootDir: string): Promise<LspServerConfig[]> {
  const configs: LspServerConfig[] = [];
  for (const cfg of SERVER_CONFIGS) {
    const matches = await Promise.all(cfg.requires.map((f) => fileExists(rootDir, f)));
    if (matches.some(Boolean)) {
      configs.push(cfg);
    }
  }
  return configs;
}

function toFileUri(rootDir: string, relPath: string): string {
  const full = path.isAbsolute(relPath) ? relPath : path.join(rootDir, relPath);
  return pathToFileURL(full).toString();
}

function extOf(filePath: string): string {
  const base = path.basename(filePath);
  const idx = base.lastIndexOf(".");
  return idx >= 0 ? base.slice(idx + 1).toLowerCase() : "";
}

function convertLspDiagnostic(rootDir: string, uri: string, d: any): Diagnostic {
  let relPath = path.relative(rootDir, new URL(uri).pathname);
  if (path.sep === "\\") relPath = relPath.replace(/\\/g, "/");
  const start = d.range?.start ?? { line: 0, character: 0 };
  const severityNum = d.severity ?? 1;
  const severity = severityNum === 1 ? "error" : severityNum === 2 ? "warning" : "info";
  const message = String(d.message ?? "");
  const source = typeof d.source === "string" ? d.source : "lsp";

  return {
    file: relPath,
    line: (start.line ?? 0) + 1,
    column: (start.character ?? 0) + 1,
    message,
    severity,
    source,
  };
}

async function startServer(rootDir: string, cfg: LspServerConfig): Promise<RunningServer | null> {
  const child = spawn(cfg.command, cfg.args, {
    cwd: rootDir,
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stderr.on("data", (chunk) => {
    console.error(`[lsp:${cfg.id}]`, chunk.toString("utf8").trim());
  });

  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin)
  );

  const diagnostics: FileDiagnostics = {};
  const pending = new Map<string, (diags: Diagnostic[]) => void>();

  connection.onNotification("textDocument/publishDiagnostics", (params: any) => {
    const uri: string = params.uri;
    const diags = Array.isArray(params.diagnostics) ? params.diagnostics : [];
    const relDiagnostics = diags.map((d: any) => convertLspDiagnostic(rootDir, uri, d));
    for (const d of relDiagnostics) {
      diagnostics[d.file] = diagnostics[d.file] ?? [];
      // replace all diagnostics for this file with this server's diagnostics for that file
    }
    // Reset per-file and fill again
    const byFile: { [file: string]: Diagnostic[] } = {};
    for (const d of relDiagnostics) {
      (byFile[d.file] = byFile[d.file] ?? []).push(d);
    }
    for (const [file, list] of Object.entries(byFile)) {
      diagnostics[file] = list;
    }

    const resolver = pending.get(uri);
    if (resolver) {
      pending.delete(uri);
      resolver(relDiagnostics);
    }
  });

  connection.listen();

  // Initialize
  const initParams = {
    processId: process.pid,
    rootUri: pathToFileURL(rootDir).toString(),
    capabilities: {},
  };

  await connection
    .sendRequest("initialize", initParams)
    .catch((err) => {
      console.error(`[lsp:${cfg.id}] initialize failed`, err);
    });

  connection.sendNotification("initialized", {});

  const running: RunningServer = {
    config: cfg,
    process: child,
    connection,
    initialized: true,
    rootDir,
    diagnostics,
    pending,
  };

  return running;
}

async function ensureServers(rootDir: string): Promise<Map<LspServerId, RunningServer>> {
  let entry = serversByRoot.get(rootDir);
  if (entry) return entry.servers;

  const configs = await detectLanguageServers(rootDir);
  const servers = new Map<LspServerId, RunningServer>();

  for (const cfg of configs) {
    try {
      const server = await startServer(rootDir, cfg);
      if (server) servers.set(cfg.id, server);
    } catch (err) {
      console.error(`[lsp:${cfg.id}] failed to start`, err);
    }
  }

  entry = { servers };
  serversByRoot.set(rootDir, entry);
  return servers;
}

async function requestDiagnosticsForFile(
  server: RunningServer,
  relPath: string,
  content: string
): Promise<Diagnostic[]> {
  const { connection, pending, rootDir } = server;
  const uri = toFileUri(rootDir, relPath);

  // Open document if not already known (idempotent for most servers)
  connection.sendNotification("textDocument/didOpen", {
    textDocument: {
      uri,
      languageId: server.config.id,
      version: 1,
      text: content,
    },
  });

  // Send full-content change
  connection.sendNotification("textDocument/didChange", {
    textDocument: { uri, version: Date.now() },
    contentChanges: [{ text: content }],
  });

  const existing = server.diagnostics[relPath];
  // Wait briefly for new diagnostics; fall back to last known if timeout.
  const timeoutMs = 1500;
  const diagPromise = new Promise<Diagnostic[]>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(uri);
      resolve(existing ?? []);
    }, timeoutMs);
    pending.set(uri, (diags) => {
      clearTimeout(timer);
      resolve(diags);
    });
  });

  const diags = await diagPromise;
  server.diagnostics[relPath] = diags;
  return diags;
}

export async function analyzeWithLsp(
  rootDir: string,
  filePaths: string[],
  readFile: (relPath: string) => Promise<string>
): Promise<Map<string, Diagnostic[]>> {
  const servers = await ensureServers(rootDir);
  if (servers.size === 0) return new Map();

  const byFile = new Map<string, Diagnostic[]>();

  const tasks: Promise<void>[] = [];

  for (const relPath of filePaths) {
    const ext = extOf(relPath);
    for (const server of servers.values()) {
      if (!server.config.exts.includes(ext)) continue;
      tasks.push(
        (async () => {
          try {
            const content = await readFile(relPath);
            const diags = await requestDiagnosticsForFile(server, relPath, content);
            if (diags.length) {
              const existing = byFile.get(relPath) ?? [];
              byFile.set(relPath, [...existing, ...diags]);
            }
          } catch (err) {
            console.error("[lsp] analyze file failed", relPath, err);
          }
        })()
      );
      break; // only send to first matching server
    }
  }

  await Promise.all(tasks);
  return byFile;
}

