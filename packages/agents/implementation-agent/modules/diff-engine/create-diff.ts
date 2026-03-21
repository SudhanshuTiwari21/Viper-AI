import type { FileDiff, Patch } from "../../pipeline/implementation.types";
import { readFile } from "../file-manager/read-file";
import { applyOperationsToContent } from "../file-manager/surgical-ops";

export function createDiffs(
  patch: Patch,
  workspacePath: string,
): FileDiff[] {
  const files = new Set<string>();
  for (const c of patch.changes) files.add(c.file);
  for (const op of patch.operations) files.add(op.file);

  return [...files].map((file) => {
    const before = readFile(workspacePath, file) ?? "";
    const fullChange = patch.changes.find((c) => c.file === file);
    let after = fullChange ? fullChange.content : before;
    const operations = patch.operations.filter((op) => op.file === file);
    if (operations.length > 0) {
      after = applyOperationsToContent(after, file, operations);
    }

    return { file, before, after };
  });
}
