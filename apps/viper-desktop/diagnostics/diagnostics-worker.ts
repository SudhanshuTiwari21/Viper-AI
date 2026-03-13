import path from "path";
import type { Diagnostic, SerializedDiagnosticsMap } from "./types";
import { analyzeEslint } from "./analyzers/eslint-analyzer";
import { analyzeWithLsp } from "./analyzers/lsp-analyzer";
import fs from "fs/promises";

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
function normRel(rootDir: string, absPath: string): string {
  const rel = path.relative(rootDir, absPath);
  return path.sep === "\\" ? rel.replace(/\\/g, "/") : rel;
}

/** Check if a relative path is inside an ignored directory. */
function isIgnored(relPath: string): boolean {
  const parts = relPath.split(/[/\\]/);
  return parts.some((p) => IGNORED_DIRS.has(p));
}

/** Collect all analyzable file paths under root (same rules as workspace tree). */
export async function collectFilePaths(rootDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: { name: string; isDirectory: () => boolean }[];
    try {
      entries = await fs.readdir(path.join(rootDir, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name)) continue;
        await walk(rel);
      } else {
        if (!isIgnored(rel)) out.push(rel);
      }
    }
  }
  await walk("");
  return out;
}

/** Run all analyzers for the given files and merge results into a single map. */
export async function runAnalyzers(
  rootDir: string,
  filePaths: string[],
  readFile: (relPath: string) => Promise<string>
): Promise<Map<string, Diagnostic[]>> {
  const merged = new Map<string, Diagnostic[]>();

  const jsLike = filePaths.filter((p) => /\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(p));

  const [lspMap, eslintMap] = await Promise.all([
    analyzeWithLsp(rootDir, filePaths, readFile),
    jsLike.length ? analyzeEslint(rootDir, jsLike) : Promise.resolve(new Map<string, Diagnostic[]>()),
  ]);

  // Merge LSP diagnostics
  for (const [relPath, list] of lspMap) {
    if (!list.length) continue;
    merged.set(relPath, [...(merged.get(relPath) ?? []), ...list]);
  }

  // Merge ESLint diagnostics
  for (const [relPath, list] of eslintMap) {
    if (!list.length) continue;
    const existing = merged.get(relPath) ?? [];
    merged.set(relPath, [...existing, ...list]);
  }

  return merged;
}

/** Serialize map for IPC. */
export function serializeDiagnosticsMap(map: Map<string, Diagnostic[]>): SerializedDiagnosticsMap {
  return Array.from(map.entries());
}
