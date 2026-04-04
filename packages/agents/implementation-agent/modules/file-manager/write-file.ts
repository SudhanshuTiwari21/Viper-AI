import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

export function writeFile(
  workspacePath: string,
  relativePath: string,
  content: string,
): void {
  const fullPath = resolve(workspacePath, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}
