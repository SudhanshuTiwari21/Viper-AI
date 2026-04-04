import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function readFile(
  workspacePath: string,
  relativePath: string,
): string | null {
  const fullPath = resolve(workspacePath, relativePath);
  if (!existsSync(fullPath)) {
    return null;
  }
  return readFileSync(fullPath, "utf-8");
}
