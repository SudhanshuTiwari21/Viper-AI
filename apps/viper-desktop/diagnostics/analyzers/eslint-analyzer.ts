import path from "path";
import type { Diagnostic } from "../types";

const LINTABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

/**
 * ESLint analyzer. Uses dynamic import so the app still runs if ESLint is not installed.
 */
export async function analyzeEslint(
  rootDir: string,
  filePaths: string[]
): Promise<Map<string, Diagnostic[]>> {
  const toLint = filePaths.filter((p) => LINTABLE_EXT.test(p));
  if (toLint.length === 0) return new Map();

  try {
    const { ESLint } = await import("eslint");
    const eslint = new ESLint({ cwd: rootDir });
    const absPaths = toLint.map((f) => path.join(rootDir, f));
    const results = await eslint.lintFiles(absPaths);
    const byFile = new Map<string, Diagnostic[]>();

    for (const result of results) {
      const relPath = path.relative(rootDir, result.filePath);
      const normalized = relPath.split(path.sep).join("/");
      const list: Diagnostic[] = (result.messages ?? []).map((m) => ({
        file: normalized,
        line: m.line ?? 1,
        column: m.column,
        message: m.message ?? "",
        severity: m.severity === 2 ? "error" : "warning",
        source: "eslint",
      }));
      if (list.length) byFile.set(normalized, list);
    }

    return byFile;
  } catch {
    return new Map();
  }
}
