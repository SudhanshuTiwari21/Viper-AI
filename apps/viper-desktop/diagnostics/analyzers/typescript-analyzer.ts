import path from "path";
import fs from "fs";
import type { Diagnostic } from "../types";

const TS_EXT = /\.(ts|tsx)$/i;

/**
 * TypeScript analyzer using the TypeScript compiler API.
 * Discovers tsconfig.json, creates a program, and returns getPreEmitDiagnostics().
 */
export async function analyzeTypeScript(
  rootDir: string,
  filePaths: string[]
): Promise<Map<string, Diagnostic[]>> {
  try {
    const ts = await import("typescript");
    const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, "tsconfig.json");
    if (!configPath) return new Map();

    const configText = fs.readFileSync(configPath, "utf8");
    const configFile = ts.readConfigFile(configPath, () => configText);
    if (configFile.error) return new Map();

    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath)
    );
    const tsFiles = filePaths.filter((p) => TS_EXT.test(p));
    if (tsFiles.length === 0) return new Map();

    const program = ts.createProgram(
      tsFiles.map((f) => path.join(rootDir, f)),
      parsed.options
    );
    const allDiagnostics = ts.getPreEmitDiagnostics(program);
    const byFile = new Map<string, Diagnostic[]>();

    for (const d of allDiagnostics) {
      const file = d.file;
      if (!file || !d.messageText) continue;
      let relPath = path.relative(rootDir, file.fileName);
      if (path.sep !== "/") relPath = relPath.split(path.sep).join("/");
      if (!filePaths.includes(relPath)) continue;

      const message =
        typeof d.messageText === "string"
          ? d.messageText
          : d.messageText.messageText;
      const severity = d.category === ts.DiagnosticCategory.Error ? "error" : "warning";
      const start = file.getLineAndCharacterOfPosition(d.start ?? 0);

      const list = byFile.get(relPath) ?? [];
      list.push({
        file: relPath,
        line: start.line + 1,
        column: start.character + 1,
        message: String(message),
        severity,
        source: "typescript",
      });
      byFile.set(relPath, list);
    }

    return byFile;
  } catch {
    return new Map();
  }
}
