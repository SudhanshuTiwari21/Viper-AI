import type { PatchOperation } from "../../pipeline/implementation.types";

function splitLines(content: string): string[] {
  return content.length === 0 ? [] : content.split("\n");
}

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

export function applyOperationsToContent(
  originalContent: string,
  file: string,
  operations: PatchOperation[],
): string {
  const lines = splitLines(originalContent);
  const sorted = [...operations].sort((a, b) => b.startLine - a.startLine);

  for (const op of sorted) {
    const startIdx = op.startLine - 1;
    const endIdx = (op.endLine ?? op.startLine) - 1;

    if (startIdx < 0 || startIdx > lines.length) {
      throw new Error(
        `Operation range out of bounds for ${file}: startLine=${op.startLine}`,
      );
    }
    if (op.type !== "insert" && (endIdx < startIdx || endIdx >= lines.length)) {
      throw new Error(
        `Operation range out of bounds for ${file}: ${op.startLine}-${op.endLine}`,
      );
    }

    if (op.expectedOldText !== undefined && op.type !== "insert") {
      const currentRange = lines.slice(startIdx, endIdx + 1).join("\n");
      if (currentRange !== op.expectedOldText) {
        throw new Error(
          `Conflict applying ${op.type} on ${file} ${op.startLine}-${op.endLine ?? op.startLine}`,
        );
      }
    }

    if (op.type === "insert") {
      const insertLines = splitLines(op.content ?? "");
      lines.splice(startIdx, 0, ...insertLines);
      continue;
    }

    if (op.type === "replace") {
      const replaceLines = splitLines(op.content ?? "");
      lines.splice(startIdx, endIdx - startIdx + 1, ...replaceLines);
      continue;
    }

    // delete
    lines.splice(startIdx, endIdx - startIdx + 1);
  }

  return joinLines(lines);
}
