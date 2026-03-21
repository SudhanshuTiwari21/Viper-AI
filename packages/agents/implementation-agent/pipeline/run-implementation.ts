import type {
  FileDiff,
  ImplementationInput,
  ImplementationResult,
  Patch,
} from "./implementation.types";
import { buildImplementationPrompt } from "../modules/prompt-builder/build-implementation-prompt";
import { generateCode } from "../modules/code-generator/generate-code";
import { generatePatch } from "../modules/patch-generator/generate-patch";
import { createDiffs } from "../modules/diff-engine/create-diff";
import { applyPatch } from "../modules/file-manager/apply-patch";
import { validateChanges } from "../modules/validator/validate-changes";
import { validateConflicts } from "../modules/validator/validate-conflicts";
import { captureStagedFiles, stageFiles } from "../modules/git/git-staging";
import { createBackupSnapshot } from "../modules/rollback/create-backup";
import { restoreBackupSnapshot } from "../modules/rollback/restore-backup";

export async function runImplementation(
  input: ImplementationInput,
): Promise<ImplementationResult> {
  const logs: string[] = [];

  logs.push("[Viper] Implementation agent started");

  // 1. Build LLM prompt from plan + context
  const prompt = buildImplementationPrompt(input);
  logs.push("[Viper] Implementation prompt built");

  // 2. Generate code via LLM
  const generated = await generateCode(prompt, logs, input.onEvent);

  // 3. Create structured patch
  const patch = generatePatch(generated);
  logs.push(
    `[Viper] Patch generated: ${patch.changes.length} file change(s), ${patch.operations.length} operation(s)`,
  );
  input.onEvent?.({
    type: "patch:generated",
    data: {
      changes: patch.changes.length,
      operations: patch.operations.length,
    },
  });

  // 4. Validate before writing
  const validation = validateChanges(patch);
  input.onEvent?.({
    type: "patch:validated",
    data: { valid: validation.valid, errors: validation.valid ? undefined : validation.errors },
  });
  if (!validation.valid) {
    logs.push(`[Viper] Validation failed: ${validation.errors.join(", ")}`);
    return { patch, diffs: [], success: false, logs };
  }
  logs.push("[Viper] Validation passed");

  // 5. Create diffs (before applying changes)
  let diffs: FileDiff[];
  try {
    diffs = createDiffs(patch, input.workspacePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`[Viper] Diff creation failed: ${message}`);
    return { patch, diffs: [], success: false, logs };
  }

  // In preview mode, return patch + diffs without applying
  if (input.mode === "preview") {
    logs.push("[Viper] Preview mode: returning patch + diffs without applying");
    return { patch, diffs, success: true, logs };
  }

  // 6. Snapshot before apply (for undo)
  const previouslyStagedFiles = captureStagedFiles(input.workspacePath);
  const rollbackId = createBackupSnapshot(
    patch,
    input.workspacePath,
    previouslyStagedFiles,
    logs,
  );

  // 7. Apply patch to filesystem
  try {
    applyPatch(patch, input.workspacePath, logs);
    logs.push("[Viper] Patch applied successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`[Viper] Patch apply failed: ${message}`);
    return { patch, diffs, success: false, logs, rollbackId };
  }

  // 8. Stage changed files in git
  const touchedFiles = [...new Set([
    ...patch.changes.map((c) => c.file),
    ...patch.operations.map((o) => o.file),
  ])];
  stageFiles(input.workspacePath, touchedFiles, logs);

  return { patch, diffs, success: true, logs, rollbackId };
}

/** Apply a previously previewed patch to disk (backup → write → stage). */
export function applyPreviewedPatch(
  patch: Patch,
  workspacePath: string,
): ImplementationResult {
  const logs: string[] = [];
  logs.push("[Viper] Applying previewed patch");

  const validation = validateChanges(patch);
  if (!validation.valid) {
    logs.push(`[Viper] Validation failed: ${validation.errors.join(", ")}`);
    return { patch, diffs: [], success: false, logs };
  }

  const conflictCheck = validateConflicts(patch, workspacePath);
  if (!conflictCheck.valid) {
    logs.push(`[Viper] Conflict re-check failed: ${conflictCheck.conflicts.join("; ")}`);
    return { patch, diffs: [], success: false, logs };
  }
  logs.push("[Viper] Conflict re-check passed");

  let diffs: FileDiff[];
  try {
    diffs = createDiffs(patch, workspacePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`[Viper] Diff creation failed: ${message}`);
    return { patch, diffs: [], success: false, logs };
  }

  const previouslyStagedFiles = captureStagedFiles(workspacePath);
  const rollbackId = createBackupSnapshot(
    patch,
    workspacePath,
    previouslyStagedFiles,
    logs,
  );

  try {
    applyPatch(patch, workspacePath, logs);
    logs.push("[Viper] Patch applied successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`[Viper] Patch apply failed: ${message}`);
    return { patch, diffs, success: false, logs, rollbackId };
  }

  const touchedFiles = [...new Set([
    ...patch.changes.map((c) => c.file),
    ...patch.operations.map((o) => o.file),
  ])];
  stageFiles(workspacePath, touchedFiles, logs);

  return { patch, diffs, success: true, logs, rollbackId };
}

export function undoImplementation(
  workspacePath: string,
  rollbackId: string,
): { success: boolean; logs: string[] } {
  const logs: string[] = [];
  const success = restoreBackupSnapshot(workspacePath, rollbackId, logs);
  return { success, logs };
}
