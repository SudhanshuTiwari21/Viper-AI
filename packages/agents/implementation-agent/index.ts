export { runImplementation, undoImplementation, applyPreviewedPatch } from "./pipeline/run-implementation";
export {
  hashPatch,
  registerPatchPreview,
  verifyPatchApplyOrThrow,
  isSubsetPatch,
  stableStringify,
} from "./pipeline/patch-integrity";
export type {
  ImplementationInput,
  ImplementationResult,
  ImplementationMode,
  FileChange,
  Patch,
  FileDiff,
  PatchOperation,
  PatchOperationType,
  GeneratedPatchPayload,
  StreamCallback,
} from "./pipeline/implementation.types";

export { buildImplementationPrompt } from "./modules/prompt-builder/build-implementation-prompt";
export { generateCode } from "./modules/code-generator/generate-code";
export { generatePatch } from "./modules/patch-generator/generate-patch";
export { applyPatch } from "./modules/file-manager/apply-patch";
export { readFile } from "./modules/file-manager/read-file";
export { writeFile } from "./modules/file-manager/write-file";
export { applyOperationsToContent } from "./modules/file-manager/surgical-ops";
export { createDiffs } from "./modules/diff-engine/create-diff";
export { validateChanges } from "./modules/validator/validate-changes";
export type { ValidationResult } from "./modules/validator/validate-changes";
export { validateConflicts } from "./modules/validator/validate-conflicts";
export type { ConflictCheckResult } from "./modules/validator/validate-conflicts";
export {
  createBackupSnapshot,
  getBackupFilePath,
} from "./modules/rollback/create-backup";
export { restoreBackupSnapshot } from "./modules/rollback/restore-backup";
export {
  captureStagedFiles,
  stageFiles,
  restoreGitStaging,
} from "./modules/git/git-staging";
export type { BackupSnapshot, BackupFileEntry } from "./modules/rollback/backup.types";
