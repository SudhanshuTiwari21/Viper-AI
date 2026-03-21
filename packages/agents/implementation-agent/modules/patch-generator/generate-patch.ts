import type {
  GeneratedPatchPayload,
  Patch,
} from "../../pipeline/implementation.types";

export function generatePatch(payload: GeneratedPatchPayload): Patch {
  return {
    changes: (payload.changes ?? []).map((c) => ({
      file: c.file,
      content: c.content,
    })),
    operations: [...(payload.operations ?? [])],
  };
}
