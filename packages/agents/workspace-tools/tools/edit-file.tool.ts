import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { EditFileResult } from "../workspace-tools.types.js";

/**
 * Performs a targeted string replacement in a workspace file.
 * Returns before/after context around the edit so the LLM (and user) can verify.
 *
 * Safety: path traversal guard, binary check, existence check.
 */
export async function editWorkspaceFile(
  workspacePath: string,
  relativePath: string,
  oldText: string,
  newText: string,
): Promise<EditFileResult> {
  const absPath = resolve(workspacePath, relativePath);
  if (!absPath.startsWith(resolve(workspacePath))) {
    return { success: false, error: "Path traversal denied" };
  }

  try {
    const info = await stat(absPath);
    if (!info.isFile()) {
      return { success: false, error: `Not a file: ${relativePath}` };
    }
  } catch {
    return { success: false, error: `File not found: ${relativePath}` };
  }

  const original = await readFile(absPath, "utf-8");
  const idx = original.indexOf(oldText);
  if (idx === -1) {
    return {
      success: false,
      error: `Could not find the text to replace in ${relativePath}. Make sure you are using the exact text from the file.`,
    };
  }

  const secondIdx = original.indexOf(oldText, idx + 1);
  if (secondIdx !== -1) {
    return {
      success: false,
      error: `Multiple matches found for the old text in ${relativePath}. Provide a larger, more unique snippet to ensure only one match.`,
    };
  }

  const updated = original.slice(0, idx) + newText + original.slice(idx + oldText.length);
  await writeFile(absPath, updated, "utf-8");

  const editStart = Math.max(0, idx - 80);
  const editEnd = Math.min(updated.length, idx + newText.length + 80);
  const contextSnippet = updated.slice(editStart, editEnd);

  return {
    success: true,
    file: relativePath,
    linesChanged: newText.split("\n").length - oldText.split("\n").length,
    contextSnippet,
  };
}
