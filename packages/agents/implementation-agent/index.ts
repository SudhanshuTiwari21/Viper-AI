export { runImplementation } from "./pipeline/run-implementation";
export type {
  ImplementationInput,
  ImplementationResult,
  FileChange,
  Patch,
  FileDiff,
} from "./pipeline/implementation.types";

export { buildImplementationPrompt } from "./modules/prompt-builder/build-implementation-prompt";
export { generateCode } from "./modules/code-generator/generate-code";
export { generatePatch } from "./modules/patch-generator/generate-patch";
export { applyPatch } from "./modules/file-manager/apply-patch";
export { readFile } from "./modules/file-manager/read-file";
export { writeFile } from "./modules/file-manager/write-file";
export { createDiffs } from "./modules/diff-engine/create-diff";
export { validateChanges } from "./modules/validator/validate-changes";
export type { ValidationResult } from "./modules/validator/validate-changes";
