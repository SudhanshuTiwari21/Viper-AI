"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeWithLsp = analyzeWithLsp;
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const node_1 = require("vscode-jsonrpc/node");
const url_1 = require("url");
const promises_1 = __importDefault(require("fs/promises"));
const SERVER_CONFIGS = [
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
const serversByRoot = new Map();
async function fileExists(rootDir, rel) {
    try {
        await promises_1.default.access(path_1.default.join(rootDir, rel));
        return true;
    }
    catch {
        return false;
    }
}
async function detectLanguageServers(rootDir) {
    const configs = [];
    for (const cfg of SERVER_CONFIGS) {
        const matches = await Promise.all(cfg.requires.map((f) => fileExists(rootDir, f)));
        if (matches.some(Boolean)) {
            configs.push(cfg);
        }
    }
    return configs;
}
function toFileUri(rootDir, relPath) {
    const full = path_1.default.isAbsolute(relPath) ? relPath : path_1.default.join(rootDir, relPath);
    return (0, url_1.pathToFileURL)(full).toString();
}
function extOf(filePath) {
    const base = path_1.default.basename(filePath);
    const idx = base.lastIndexOf(".");
    return idx >= 0 ? base.slice(idx + 1).toLowerCase() : "";
}
function convertLspDiagnostic(rootDir, uri, d) {
    let relPath = path_1.default.relative(rootDir, new URL(uri).pathname);
    if (path_1.default.sep === "\\")
        relPath = relPath.replace(/\\/g, "/");
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
async function startServer(rootDir, cfg) {
    const child = (0, child_process_1.spawn)(cfg.command, cfg.args, {
        cwd: rootDir,
        stdio: ["pipe", "pipe", "pipe"],
    });
    child.stderr.on("data", (chunk) => {
        console.error(`[lsp:${cfg.id}]`, chunk.toString("utf8").trim());
    });
    const connection = (0, vscode_jsonrpc_1.createMessageConnection)(new node_1.StreamMessageReader(child.stdout), new node_1.StreamMessageWriter(child.stdin));
    const diagnostics = {};
    const pending = new Map();
    connection.onNotification("textDocument/publishDiagnostics", (params) => {
        const uri = params.uri;
        const diags = Array.isArray(params.diagnostics) ? params.diagnostics : [];
        const relDiagnostics = diags.map((d) => convertLspDiagnostic(rootDir, uri, d));
        for (const d of relDiagnostics) {
            diagnostics[d.file] = diagnostics[d.file] ?? [];
            // replace all diagnostics for this file with this server's diagnostics for that file
        }
        // Reset per-file and fill again
        const byFile = {};
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
        rootUri: (0, url_1.pathToFileURL)(rootDir).toString(),
        capabilities: {},
    };
    await connection
        .sendRequest("initialize", initParams)
        .catch((err) => {
        console.error(`[lsp:${cfg.id}] initialize failed`, err);
    });
    connection.sendNotification("initialized", {});
    const running = {
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
async function ensureServers(rootDir) {
    let entry = serversByRoot.get(rootDir);
    if (entry)
        return entry.servers;
    const configs = await detectLanguageServers(rootDir);
    const servers = new Map();
    for (const cfg of configs) {
        try {
            const server = await startServer(rootDir, cfg);
            if (server)
                servers.set(cfg.id, server);
        }
        catch (err) {
            console.error(`[lsp:${cfg.id}] failed to start`, err);
        }
    }
    entry = { servers };
    serversByRoot.set(rootDir, entry);
    return servers;
}
async function requestDiagnosticsForFile(server, relPath, content) {
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
    const diagPromise = new Promise((resolve) => {
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
async function analyzeWithLsp(rootDir, filePaths, readFile) {
    const servers = await ensureServers(rootDir);
    if (servers.size === 0)
        return new Map();
    const byFile = new Map();
    const tasks = [];
    for (const relPath of filePaths) {
        const ext = extOf(relPath);
        for (const server of servers.values()) {
            if (!server.config.exts.includes(ext))
                continue;
            tasks.push((async () => {
                try {
                    const content = await readFile(relPath);
                    const diags = await requestDiagnosticsForFile(server, relPath, content);
                    if (diags.length) {
                        const existing = byFile.get(relPath) ?? [];
                        byFile.set(relPath, [...existing, ...diags]);
                    }
                }
                catch (err) {
                    console.error("[lsp] analyze file failed", relPath, err);
                }
            })());
            break; // only send to first matching server
        }
    }
    await Promise.all(tasks);
    return byFile;
}
