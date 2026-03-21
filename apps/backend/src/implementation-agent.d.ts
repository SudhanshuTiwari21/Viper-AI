declare module "@repo/implementation-agent" {
  export interface Patch {
    changes: Array<{ file: string; content: string }>;
    operations: Array<{
      file: string;
      type: "insert" | "replace" | "delete";
      startLine: number;
      endLine?: number;
      content?: string;
      expectedOldText?: string;
    }>;
  }

  export interface FileDiff {
    file: string;
    before: string;
    after: string;
  }

  export interface ImplementationResult {
    patch: Patch;
    diffs: FileDiff[];
    success: boolean;
    logs: string[];
    rollbackId?: string;
  }

  export function applyPreviewedPatch(
    patch: Patch,
    workspacePath: string,
  ): ImplementationResult;

  export function undoImplementation(
    workspacePath: string,
    rollbackId: string,
  ): { success: boolean; logs: string[] };

  export function verifyPatchApplyOrThrow(
    incoming: Patch,
    previewId: string,
    clientPatchHash: string,
    workspacePath: string,
  ): void;
}
