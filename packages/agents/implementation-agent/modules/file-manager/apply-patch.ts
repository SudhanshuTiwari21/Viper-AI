import type { Patch } from "../../pipeline/implementation.types";
import { readFile } from "./read-file";
import { writeFile } from "./write-file";
import { applyOperationsToContent } from "./surgical-ops";

export function applyPatch(
  patch: Patch,
  workspacePath: string,
  logs: string[],
): void {
  for (const change of patch.changes) {
    logs.push(`[Viper] Writing file: ${change.file}`);
    writeFile(workspacePath, change.file, change.content);
  }

  const byFile = new Map<string, typeof patch.operations>();
  for (const op of patch.operations) {
    const list = byFile.get(op.file) ?? [];
    list.push(op);
    byFile.set(op.file, list);
  }

  for (const [file, operations] of byFile.entries()) {
    const current = readFile(workspacePath, file) ?? "";
    const updated = applyOperationsToContent(current, file, operations);
    logs.push(
      `[Viper] Applying ${operations.length} surgical operation(s) to: ${file}`,
    );
    writeFile(workspacePath, file, updated);
  }
}
