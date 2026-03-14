import type { RankedCandidate } from "../score-aggregator/score-aggregator.types.js";
import type { RankedContextBundle, RankedSnippet } from "./topk-selector.types.js";
import { MinHeap } from "./min-heap.js";

export const CONTEXT_LIMITS = {
  files: 5,
  functions: 10,
  snippets: 10,
} as const;

const getScore = (rc: RankedCandidate) => rc.finalScore;

/**
 * Select top-K candidates by finalScore using min-heaps (O(n) over candidates).
 * Returns RankedContextBundle with files, functions, and snippets sorted by score descending.
 */
export function selectTopK(
  rankedCandidates: RankedCandidate[],
): RankedContextBundle {
  const filesHeap = new MinHeap<RankedCandidate>(
    CONTEXT_LIMITS.files,
    getScore,
  );
  const functionsHeap = new MinHeap<RankedCandidate>(
    CONTEXT_LIMITS.functions,
    getScore,
  );
  const snippetsHeap = new MinHeap<RankedCandidate>(
    CONTEXT_LIMITS.snippets,
    getScore,
  );

  for (let i = 0; i < rankedCandidates.length; i++) {
    const rc = rankedCandidates[i]!;
    const type = rc.candidate.type;
    if (type === "file") {
      filesHeap.push(rc);
    } else if (type === "function" || type === "class") {
      functionsHeap.push(rc);
    } else if (type === "chunk") {
      snippetsHeap.push(rc);
    }
  }

  const files = dedupeOrdered(
    filesHeap.toSortedArray().map((rc) => rc.candidate.file ?? ""),
    (f) => f,
  ).filter((f) => f.length > 0);

  const functions = dedupeOrdered(
    functionsHeap.toSortedArray().map((rc) => rc.candidate.symbol ?? ""),
    (s) => s,
  ).filter((s) => s.length > 0);

  const snippetKeys = new Set<string>();
  const snippets: RankedSnippet[] = [];
  for (const rc of snippetsHeap.toSortedArray()) {
    const file = rc.candidate.file ?? "";
    const content = rc.candidate.content ?? "";
    const key = `${file}\0${content}`;
    if (snippetKeys.has(key)) continue;
    snippetKeys.add(key);
    snippets.push({ file, content, score: rc.finalScore });
  }

  return { files, functions, snippets };
}

function dedupeOrdered<T>(arr: T[], keyFn: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}
