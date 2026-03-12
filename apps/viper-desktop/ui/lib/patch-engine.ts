import type { CodePatch, MultiFilePatch, PatchChange } from "./patch-types";

function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

export interface PatchValidationError {
  file: string;
  message: string;
}

export interface PatchValidationResult {
  ok: boolean;
  errors: PatchValidationError[];
}

export function validatePatchAgainstContent(
  file: string,
  content: string,
  patch: CodePatch
): PatchValidationResult {
  const errors: PatchValidationError[] = [];
  const lines = splitLines(content);
  const totalLines = lines.length;

  patch.changes.forEach((change, idx) => {
    const { startLine, endLine } = change;
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
      errors.push({
        file,
        message: `Change #${idx + 1}: startLine/endLine must be integers`,
      });
      return;
    }
    if (startLine < 1) {
      errors.push({
        file,
        message: `Change #${idx + 1}: startLine must be >= 1 (got ${startLine})`,
      });
    }
    if (endLine < startLine) {
      errors.push({
        file,
        message: `Change #${idx + 1}: endLine (${endLine}) must be >= startLine (${startLine})`,
      });
    }
    if (endLine > totalLines) {
      errors.push({
        file,
        message: `Change #${idx + 1}: endLine (${endLine}) exceeds file line count (${totalLines})`,
      });
    }
  });

  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Apply a single-file patch to a string of file contents.
 * Line numbers are 1-based and inclusive.
 */
export function applyPatchToContent(content: string, patch: CodePatch): string {
  if (!patch.changes.length) return content;

  // Apply from bottom to top so earlier edits don't affect later ranges.
  const sorted = [...patch.changes].sort(
    (a, b) => b.startLine - a.startLine
  );

  let lines = splitLines(content);

  for (const change of sorted) {
    const { startLine, endLine, newContent } = change;
    const startIdx = Math.max(0, startLine - 1);
    const endIdx = Math.max(0, endLine); // endLine is inclusive

    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx);
    const replacementLines = splitLines(newContent);

    lines = [...before, ...replacementLines, ...after];
  }

  return joinLines(lines);
}

export interface FilePatchApplicationResult {
  file: string;
  originalContent: string;
  newContent: string;
}

export interface MultiFilePatchApplicationResult {
  results: FilePatchApplicationResult[];
}

/**
 * Apply a multi-file patch to an in-memory map of file contents.
 * Returns a new map and does not mutate the input.
 */
export function applyMultiFilePatchToContents(
  contentsByFile: Map<string, string>,
  multi: MultiFilePatch
): { updated: Map<string, string>; result: MultiFilePatchApplicationResult } {
  const updated = new Map(contentsByFile);
  const results: FilePatchApplicationResult[] = [];

  for (const patch of multi.patches) {
    const current = updated.get(patch.file);
    if (typeof current !== "string") {
      // Skip non-existent files; caller can decide how to handle this.
      continue;
    }
    const next = applyPatchToContent(current, patch);
    updated.set(patch.file, next);
    results.push({
      file: patch.file,
      originalContent: current,
      newContent: next,
    });
  }

  return { updated, result: { results } };
}

export interface DiffChunk {
  /**
   * Line content without trailing newline.
   */
  value: string;
  /**
   * True if this line was added.
   */
  added?: boolean;
  /**
   * True if this line was removed.
   */
  removed?: boolean;
}

export interface FileDiff {
  file: string;
  chunks: DiffChunk[];
}

/**
 * Generate a human-readable line diff for a single file.
 * Uses the patch engine to compute the "after" content.
 */
export function diffContentWithPatch(
  file: string,
  originalContent: string,
  patch: CodePatch
): FileDiff {
  // Lazy import to avoid tying core types to a specific diff implementation.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { diffLines } = require("diff") as {
    diffLines: (a: string, b: string) => { value: string; added?: boolean; removed?: boolean }[];
  };

  const next = applyPatchToContent(originalContent, patch);
  const rawChunks = diffLines(originalContent, next);

  const chunks: DiffChunk[] = rawChunks.map((c) => ({
    value: c.value.replace(/\r?\n$/, ""),
    added: c.added,
    removed: c.removed,
  }));

  return {
    file,
    chunks,
  };
}

