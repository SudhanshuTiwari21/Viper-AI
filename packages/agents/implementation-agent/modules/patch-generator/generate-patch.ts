import type { FileChange, Patch } from "../../pipeline/implementation.types";

export function generatePatch(changes: FileChange[]): Patch {
  return {
    changes: changes.map((c) => ({
      file: c.file,
      content: c.content,
    })),
  };
}
