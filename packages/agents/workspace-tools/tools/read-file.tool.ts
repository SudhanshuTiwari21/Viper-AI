import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { ReadFileResult } from "../workspace-tools.types.js";

const MAX_FILE_BYTES = 50 * 1024; // 50 KB

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".avi", ".mov",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".wasm", ".exe", ".dll", ".so", ".dylib",
  ".bin", ".dat", ".db", ".sqlite",
  ".pyc", ".class", ".o", ".obj",
  ".lock",
]);

function isBinaryExtension(filePath: string): boolean {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return false;
  return BINARY_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}

export async function readWorkspaceFile(
  workspacePath: string,
  relativePath: string,
): Promise<ReadFileResult | null> {
  const absPath = resolve(workspacePath, relativePath);

  if (!absPath.startsWith(resolve(workspacePath))) {
    return null;
  }

  if (isBinaryExtension(relativePath)) {
    return null;
  }

  try {
    const info = await stat(absPath);
    if (!info.isFile()) return null;

    const sizeBytes = info.size;
    const truncated = sizeBytes > MAX_FILE_BYTES;

    const raw = await readFile(absPath, "utf-8");
    const content = truncated ? raw.slice(0, MAX_FILE_BYTES) : raw;
    const lines = content.split("\n").length;

    return { content, lines, truncated, sizeBytes };
  } catch {
    return null;
  }
}
