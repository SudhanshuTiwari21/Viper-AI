import fs from "fs/promises";
import path from "path";
import type { Dirent } from "fs";
import type { FileWalkerResult, WalkOptions } from "../types/filewalker.types";

/** Default dirs/files to ignore (aligns with .gitignore-style and Repo Scanner spec) */
const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  "vendor",
  ".git",
  ".next",
  ".nuxt",
  ".output",
  "out",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".vite",
  "__pycache__",
  ".venv",
  "venv",
  "target", // Java/Maven
  "bin",
  "obj", // .NET
]);

export class FileSysWalkerService {
  /**
   * Recursively walks the file system under repoPath and returns relative file paths.
   * Respects a default ignore list (node_modules, dist, .git, etc.).
   */
  async walk(repoPath: string, options: WalkOptions = {}): Promise<FileWalkerResult> {
    const basePath = options.basePath ?? repoPath;
    const files: string[] = [];
    const directories: string[] = [];

    const visit = async (dir: string): Promise<void> => {
      let entries: Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(basePath, fullPath);
        const segment = entry.name;

        if (entry.isDirectory()) {
          if (DEFAULT_IGNORE_DIRS.has(segment)) continue;
          if (segment.startsWith(".") && segment !== "." && segment !== "..") continue;
          directories.push(relativePath);
          await visit(fullPath);
        } else if (entry.isFile()) {
          if (this.shouldIgnoreFile(relativePath, options.ignorePatterns)) continue;
          files.push(relativePath);
        }
      }
    };

    await visit(repoPath);

    return options.filesOnly ? { files, directories: [] } : { files, directories };
  }

  /**
   * Returns only the array of relative file paths (convenience for pipeline).
   */
  async walkFiles(repoPath: string, options: WalkOptions = {}): Promise<string[]> {
    const result = await this.walk(repoPath, { ...options, filesOnly: true });
    return result.files;
  }

  private shouldIgnoreFile(relativePath: string, extraPatterns?: string[]): boolean {
    const parts = relativePath.split(path.sep);
    for (const part of parts) {
      if (DEFAULT_IGNORE_DIRS.has(part)) return true;
    }
    if (extraPatterns?.length) {
      const normalized = relativePath.replace(/\\/g, "/");
      for (const pattern of extraPatterns) {
        if (this.matchPattern(normalized, pattern)) return true;
      }
    }
    return false;
  }

  private matchPattern(filePath: string, pattern: string): boolean {
    if (pattern.startsWith("*")) {
      return filePath.endsWith(pattern.slice(1));
    }
    if (pattern.endsWith("*")) {
      return filePath.startsWith(pattern.slice(0, -1));
    }
    return filePath === pattern || filePath.endsWith(pattern);
  }
}
