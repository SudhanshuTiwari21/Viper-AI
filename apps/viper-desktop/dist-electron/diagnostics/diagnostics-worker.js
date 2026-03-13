"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectFilePaths = collectFilePaths;
exports.runAnalyzers = runAnalyzers;
exports.serializeDiagnosticsMap = serializeDiagnosticsMap;
const path_1 = __importDefault(require("path"));
const eslint_analyzer_1 = require("./analyzers/eslint-analyzer");
const lsp_analyzer_1 = require("./analyzers/lsp-analyzer");
const promises_1 = __importDefault(require("fs/promises"));
const IGNORED_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".cache",
    ".turbo",
    "out",
    ".vite",
    ".viper",
]);
/** Normalize path to forward slashes for consistency. */
function normRel(rootDir, absPath) {
    const rel = path_1.default.relative(rootDir, absPath);
    return path_1.default.sep === "\\" ? rel.replace(/\\/g, "/") : rel;
}
/** Check if a relative path is inside an ignored directory. */
function isIgnored(relPath) {
    const parts = relPath.split(/[/\\]/);
    return parts.some((p) => IGNORED_DIRS.has(p));
}
/** Collect all analyzable file paths under root (same rules as workspace tree). */
async function collectFilePaths(rootDir) {
    const out = [];
    async function walk(dir) {
        let entries;
        try {
            entries = await promises_1.default.readdir(path_1.default.join(rootDir, dir), { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const e of entries) {
            const rel = dir ? `${dir}/${e.name}` : e.name;
            if (e.isDirectory()) {
                if (IGNORED_DIRS.has(e.name))
                    continue;
                await walk(rel);
            }
            else {
                if (!isIgnored(rel))
                    out.push(rel);
            }
        }
    }
    await walk("");
    return out;
}
/** Run all analyzers for the given files and merge results into a single map. */
async function runAnalyzers(rootDir, filePaths, readFile) {
    const merged = new Map();
    const jsLike = filePaths.filter((p) => /\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(p));
    const [lspMap, eslintMap] = await Promise.all([
        (0, lsp_analyzer_1.analyzeWithLsp)(rootDir, filePaths, readFile),
        jsLike.length ? (0, eslint_analyzer_1.analyzeEslint)(rootDir, jsLike) : Promise.resolve(new Map()),
    ]);
    // Merge LSP diagnostics
    for (const [relPath, list] of lspMap) {
        if (!list.length)
            continue;
        merged.set(relPath, [...(merged.get(relPath) ?? []), ...list]);
    }
    // Merge ESLint diagnostics
    for (const [relPath, list] of eslintMap) {
        if (!list.length)
            continue;
        const existing = merged.get(relPath) ?? [];
        merged.set(relPath, [...existing, ...list]);
    }
    return merged;
}
/** Serialize map for IPC. */
function serializeDiagnosticsMap(map) {
    return Array.from(map.entries());
}
