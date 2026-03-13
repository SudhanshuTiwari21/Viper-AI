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
const typescript_analyzer_1 = require("./analyzers/typescript-analyzer");
const python_analyzer_1 = require("./analyzers/python-analyzer");
const generic_analyzer_1 = require("./analyzers/generic-analyzer");
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
    const tsLike = filePaths.filter((p) => /\.(ts|tsx)$/i.test(p));
    const pyLike = filePaths.filter((p) => /\.py$/i.test(p));
    // Primary analyzers: ESLint + language-specific compilers/linters.
    let eslintMap = new Map();
    try {
        eslintMap = jsLike.length
            ? await (0, eslint_analyzer_1.analyzeEslint)(rootDir, jsLike)
            : new Map();
    }
    catch (err) {
        console.error("[diagnostics] ESLint analyzer failed", err);
    }
    // Merge ESLint diagnostics
    for (const [relPath, list] of eslintMap) {
        if (!list.length)
            continue;
        const existing = merged.get(relPath) ?? [];
        merged.set(relPath, [...existing, ...list]);
    }
    // Fallback TypeScript analyzer: only run for TS/TSX files that don't already
    // have LSP diagnostics. This makes sure users still get TS errors even when
    // LSP servers cannot be spawned from Electron.
    if (tsLike.length) {
        try {
            const tsMap = await (0, typescript_analyzer_1.analyzeTypeScript)(rootDir, tsLike);
            for (const [relPath, list] of tsMap) {
                if (!list.length)
                    continue;
                const existing = merged.get(relPath) ?? [];
                if (existing.length === 0) {
                    merged.set(relPath, list);
                }
                else {
                    merged.set(relPath, [...existing, ...list]);
                }
            }
        }
        catch (err) {
            console.error("[diagnostics] TypeScript analyzer failed", err);
        }
    }
    // Python analyzer: run pyflakes-based diagnostics for .py files.
    if (pyLike.length) {
        await Promise.all(pyLike.map(async (relPath) => {
            try {
                const diags = await (0, python_analyzer_1.analyzePython)(rootDir, relPath, "");
                if (!diags.length)
                    return;
                const existing = merged.get(relPath) ?? [];
                merged.set(relPath, [...existing, ...diags]);
            }
            catch (err) {
                console.error("[diagnostics] Python analyzer failed", relPath, err);
            }
        }));
    }
    // Generic analyzer: lightweight, runs for all files and only adds informational
    // TODO/FIXME-style diagnostics that don't depend on external tooling.
    await Promise.all(filePaths.map(async (relPath) => {
        try {
            const content = await readFile(relPath);
            const diags = (0, generic_analyzer_1.analyzeGeneric)(relPath, content);
            if (!diags.length)
                return;
            const existing = merged.get(relPath) ?? [];
            merged.set(relPath, [...existing, ...diags]);
        }
        catch {
            // ignore generic-analyzer failures per file
        }
    }));
    return merged;
}
/** Serialize map for IPC. */
function serializeDiagnosticsMap(map) {
    return Array.from(map.entries());
}
