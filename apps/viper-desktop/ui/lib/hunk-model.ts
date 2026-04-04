/**
 * Hunk-level diff model.
 * Splits a file diff into discrete hunks (contiguous groups of changes)
 * so the user can accept/reject individual change blocks, not just whole files.
 */

export type DiffLineType = "context" | "added" | "removed";

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

export interface Hunk {
  /** Stable id: "file:hunkIdx" */
  id: string;
  /** 0-based index within the file */
  index: number;
  /** Lines in this hunk (may include context padding). */
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
}

export interface FileDiffWithHunks {
  file: string;
  before: string;
  after: string;
  hunks: Hunk[];
}

const CONTEXT_LINES = 3;

/** Compute line-level diff between `before` and `after`. */
export function computeLineChanges(before: string, after: string): DiffLine[] {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const lines: DiffLine[] = [];

  let oi = 0;
  let ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      lines.push({ type: "context", text: oldLines[oi]! });
      oi++;
      ni++;
    } else if (oi < oldLines.length && (ni >= newLines.length || oldLines[oi] !== newLines[ni])) {
      lines.push({ type: "removed", text: oldLines[oi]! });
      oi++;
    } else {
      lines.push({ type: "added", text: newLines[ni]! });
      ni++;
    }
  }

  return lines;
}

/**
 * Group diff lines into hunks.
 * A hunk = contiguous block of added/removed lines, plus up to `CONTEXT_LINES` padding.
 */
export function splitIntoHunks(file: string, lines: DiffLine[]): Hunk[] {
  const changeIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.type !== "context") changeIndices.push(i);
  }
  if (changeIndices.length === 0) return [];

  const ranges: Array<[number, number]> = [];
  let rangeStart = changeIndices[0]!;
  let rangeEnd = changeIndices[0]!;

  for (let i = 1; i < changeIndices.length; i++) {
    const ci = changeIndices[i]!;
    if (ci - rangeEnd <= CONTEXT_LINES * 2 + 1) {
      rangeEnd = ci;
    } else {
      ranges.push([rangeStart, rangeEnd]);
      rangeStart = ci;
      rangeEnd = ci;
    }
  }
  ranges.push([rangeStart, rangeEnd]);

  return ranges.map(([start, end], idx) => {
    const from = Math.max(0, start - CONTEXT_LINES);
    const to = Math.min(lines.length - 1, end + CONTEXT_LINES);
    const hunkLines = lines.slice(from, to + 1);
    return {
      id: `${file}:${idx}`,
      index: idx,
      lines: hunkLines,
      addedCount: hunkLines.filter((l) => l.type === "added").length,
      removedCount: hunkLines.filter((l) => l.type === "removed").length,
    };
  });
}

/** Build full hunk model from a diff. */
export function buildFileDiffWithHunks(diff: {
  file: string;
  before: string;
  after: string;
}): FileDiffWithHunks {
  const lines = computeLineChanges(diff.before, diff.after);
  const hunks = splitIntoHunks(diff.file, lines);
  return { file: diff.file, before: diff.before, after: diff.after, hunks };
}

/**
 * Apply only accepted hunks to the `before` text and produce a new `after`.
 * Rejected hunks revert to original lines.
 */
export function applySelectedHunks(
  before: string,
  after: string,
  acceptedHunkIds: Set<string>,
  file: string,
): string {
  const allLines = computeLineChanges(before, after);
  const hunks = splitIntoHunks(file, allLines);

  const changeLineAccepted = new Map<number, boolean>();
  for (const hunk of hunks) {
    const accepted = acceptedHunkIds.has(hunk.id);
    const from = Math.max(
      0,
      allLines.indexOf(hunk.lines[0]!),
    );
    for (let i = from; i < from + hunk.lines.length && i < allLines.length; i++) {
      if (allLines[i]!.type !== "context") {
        changeLineAccepted.set(i, accepted);
      }
    }
  }

  const result: string[] = [];
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i]!;
    if (line.type === "context") {
      result.push(line.text);
    } else if (line.type === "added") {
      if (changeLineAccepted.get(i) === true) {
        result.push(line.text);
      }
    } else if (line.type === "removed") {
      if (changeLineAccepted.get(i) !== true) {
        result.push(line.text);
      }
    }
  }
  return result.join("\n");
}
