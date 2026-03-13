import path from "path";
import type { Diagnostic, SerializedDiagnosticsMap } from "./types";
import { analyzeEslint } from "./analyzers/eslint-analyzer";
import { analyzeTypeScript } from "./analyzers/typescript-analyzer";
import { analyzePython } from "./analyzers/python-analyzer";
import { analyzeGeneric } from "./analyzers/generic-analyzer";
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
  const tsLike = filePaths.filter((p) => /\.(ts|tsx)$/i.test(p));
  const pyLike = filePaths.filter((p) => /\.py$/i.test(p));

  // Primary analyzers: ESLint + language-specific compilers/linters.
  let eslintMap = new Map<string, Diagnostic[]>();

  try {
    eslintMap = jsLike.length
      ? await analyzeEslint(rootDir, jsLike)
      : new Map<string, Diagnostic[]>();
  } catch (err) {
    console.error("[diagnostics] ESLint analyzer failed", err);
  }

  // Merge ESLint diagnostics
  for (const [relPath, list] of eslintMap) {
    if (!list.length) continue;
    const existing = merged.get(relPath) ?? [];
    merged.set(relPath, [...existing, ...list]);
  }

  // Fallback TypeScript analyzer: only run for TS/TSX files that don't already
  // have LSP diagnostics. This makes sure users still get TS errors even when
  // LSP servers cannot be spawned from Electron.
  if (tsLike.length) {
    try {
      const tsMap = await analyzeTypeScript(rootDir, tsLike);
      for (const [relPath, list] of tsMap) {
        if (!list.length) continue;
        const existing = merged.get(relPath) ?? [];
        if (existing.length === 0) {
          merged.set(relPath, list);
        } else {
          merged.set(relPath, [...existing, ...list]);
        }
      }
    } catch (err) {
      console.error("[diagnostics] TypeScript analyzer failed", err);
    }
  }

  // Python analyzer: run pyflakes-based diagnostics for .py files.
  if (pyLike.length) {
    await Promise.all(
      pyLike.map(async (relPath) => {
        try {
          const diags = await analyzePython(rootDir, relPath, "");
          if (!diags.length) return;
          const existing = merged.get(relPath) ?? [];
          merged.set(relPath, [...existing, ...diags]);
        } catch (err) {
          console.error("[diagnostics] Python analyzer failed", relPath, err);
        }
      })
    );
  }

  // Generic analyzer: lightweight, runs for all files and only adds informational
  // TODO/FIXME-style diagnostics that don't depend on external tooling.
  await Promise.all(
    filePaths.map(async (relPath) => {
      try {
        const content = await readFile(relPath);
        const diags = analyzeGeneric(relPath, content);
        if (!diags.length) return;
        const existing = merged.get(relPath) ?? [];
        merged.set(relPath, [...existing, ...diags]);
      } catch {
        // ignore generic-analyzer failures per file
      }
    })
  );

  return merged;
}

/** Serialize map for IPC. */
export function serializeDiagnosticsMap(map: Map<string, Diagnostic[]>): SerializedDiagnosticsMap {
  return Array.from(map.entries());
}
