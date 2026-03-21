import type { FileDiff, Patch } from "../../pipeline/implementation.types";
import { readFile } from "../file-manager/read-file";

export function createDiffs(
  patch: Patch,
  workspacePath: string,
): FileDiff[] {
  return patch.changes.map((change) => {
    const before = readFile(workspacePath, change.file) ?? "";
    return {
      file: change.file,
      before,
      after: change.content,
    };
  });
}
