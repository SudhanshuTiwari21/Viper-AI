import type { Patch } from "../../pipeline/implementation.types";
import { writeFile } from "./write-file";

export function applyPatch(
  patch: Patch,
  workspacePath: string,
  logs: string[],
): void {
  for (const change of patch.changes) {
    logs.push(`[Viper] Writing file: ${change.file}`);
    writeFile(workspacePath, change.file, change.content);
  }
}
