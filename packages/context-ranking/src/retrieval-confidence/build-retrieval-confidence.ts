import type { RankedCandidate } from "../score-aggregator/score-aggregator.types.js";
import type { RankedContextBundle } from "../topk-selector/topk-selector.types.js";
import type { ContextWindow } from "../context-window-builder/context-window.types.js";

export const RETRIEVAL_CONFIDENCE_SCHEMA_VERSION = "1.0" as const;

export interface RetrievalConfidenceV1 {
  schema_version: typeof RETRIEVAL_CONFIDENCE_SCHEMA_VERSION;
  /** Operator-facing score in [0, 1]; see `buildRetrievalConfidence` formula. */
  overall: number;
  counts: {
    candidatesConsidered: number;
    filesSelected: number;
    functionsSelected: number;
    snippetsSelected: number;
    estimatedTokens: number;
  };
  signals?: {
    /** Highest snippet score among selected chunks, or pool max when no snippets. */
    maxScore: number;
    /** Mean of selected snippet scores when snippets exist. */
    meanScore?: number;
  };
  /**
   * Coarse pipeline hint only: `degraded` = zero candidates after generate+score;
   * `ready` = non-empty candidate set. Not a guarantee of vector-index freshness.
   */
  index_state?: "unknown" | "ready" | "degraded";
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Compute a single `overall` confidence in [0, 1] from the Top-K bundle and full ranked pool.
 *
 * Formula:
 * - Let `poolMax` = max `finalScore` over all ranked candidates (0 if none).
 * - **Snippets selected:** `overall = clamp(0.5 * max(snippet.score) + 0.5 * mean(snippet.score))`.
 *   (Snippets carry `finalScore` from ranking; they are the strongest signal.)
 * - **No snippets but files or functions selected:** `overall = clamp(poolMax * 0.85)` — file/function
 *   entries in the bundle do not carry per-item scores here, so we down-weight vs explicit chunk scores.
 * - **No candidates in the pool:** `overall = 0`.
 * - **Non-empty pool but empty bundle:** `overall = clamp(poolMax * 0.35)` — weak evidence after selection.
 */
export function buildRetrievalConfidence(args: {
  rankedCandidates: RankedCandidate[];
  bundle: RankedContextBundle;
  contextWindow: ContextWindow;
}): RetrievalConfidenceV1 {
  const { rankedCandidates, bundle, contextWindow } = args;
  const n = rankedCandidates.length;
  const poolMax = n === 0 ? 0 : Math.max(...rankedCandidates.map((c) => c.finalScore));

  const snippetScores = bundle.snippets.map((s) => s.score);

  let overall: number;
  if (snippetScores.length > 0) {
    const maxS = Math.max(...snippetScores);
    const meanS = snippetScores.reduce((a, b) => a + b, 0) / snippetScores.length;
    overall = clamp01(0.5 * maxS + 0.5 * meanS);
  } else if (bundle.files.length + bundle.functions.length > 0) {
    overall = clamp01(poolMax * 0.85);
  } else if (n === 0) {
    overall = 0;
  } else {
    overall = clamp01(poolMax * 0.35);
  }

  let signals: RetrievalConfidenceV1["signals"];
  if (snippetScores.length > 0) {
    signals = {
      maxScore: Math.max(...snippetScores),
      meanScore: snippetScores.reduce((a, b) => a + b, 0) / snippetScores.length,
    };
  } else if (poolMax > 0) {
    signals = { maxScore: poolMax };
  }

  const index_state: RetrievalConfidenceV1["index_state"] =
    n === 0 ? "degraded" : "ready";

  return {
    schema_version: RETRIEVAL_CONFIDENCE_SCHEMA_VERSION,
    overall,
    counts: {
      candidatesConsidered: n,
      filesSelected: bundle.files.length,
      functionsSelected: bundle.functions.length,
      snippetsSelected: bundle.snippets.length,
      estimatedTokens: contextWindow.estimatedTokens,
    },
    ...(signals ? { signals } : {}),
    index_state,
  };
}
