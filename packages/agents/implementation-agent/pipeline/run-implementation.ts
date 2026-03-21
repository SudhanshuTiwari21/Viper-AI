import type {
  ImplementationInput,
  ImplementationResult,
} from "./implementation.types";
import { buildImplementationPrompt } from "../modules/prompt-builder/build-implementation-prompt";
import { generateCode } from "../modules/code-generator/generate-code";
import { generatePatch } from "../modules/patch-generator/generate-patch";
import { createDiffs } from "../modules/diff-engine/create-diff";
import { applyPatch } from "../modules/file-manager/apply-patch";
import { validateChanges } from "../modules/validator/validate-changes";

export async function runImplementation(
  input: ImplementationInput,
): Promise<ImplementationResult> {
  const logs: string[] = [];

  logs.push("[Viper] Implementation agent started");

  // 1. Build LLM prompt from plan + context
  const prompt = buildImplementationPrompt(input);
  logs.push("[Viper] Implementation prompt built");

  // 2. Generate code via LLM
  const changes = await generateCode(prompt, logs);

  // 3. Create structured patch
  const patch = generatePatch(changes);
  logs.push(`[Viper] Patch generated: ${patch.changes.length} file(s)`);

  // 4. Validate before writing
  const validation = validateChanges(patch);
  if (!validation.valid) {
    logs.push(`[Viper] Validation failed: ${validation.errors.join(", ")}`);
    return { patch, diffs: [], success: false, logs };
  }
  logs.push("[Viper] Validation passed");

  // 5. Create diffs (before applying changes)
  const diffs = createDiffs(patch, input.workspacePath);

  // 6. Apply patch to filesystem
  applyPatch(patch, input.workspacePath, logs);
  logs.push("[Viper] Patch applied successfully");

  return { patch, diffs, success: true, logs };
}
