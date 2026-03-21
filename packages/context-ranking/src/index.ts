export { generateCandidates } from "./candidate-generator/generate-candidates.js";
export type { ContextCandidate, ContextCandidateType } from "./candidate-generator/candidate.types.js";

export { computeCandidateScores } from "./scoring-engine/compute-candidate-scores.js";
export type { ScoredCandidate, ScoringContext } from "./scoring-engine/scoring.types.js";

export { combineScores, SCORE_WEIGHTS } from "./score-aggregator/combine-scores.js";
export type { RankedCandidate } from "./score-aggregator/score-aggregator.types.js";

export { selectTopK, CONTEXT_LIMITS } from "./topk-selector/select-topk.js";
export type { TopKLimits } from "./topk-selector/select-topk.js";
export type { RankedContextBundle, RankedSnippet } from "./topk-selector/topk-selector.types.js";

export {
  buildContextWindow,
  DEFAULT_TOKEN_LIMIT,
  CONTEXT_TOKEN_BUDGET,
} from "./context-window-builder/build-context-window.js";
export type { ContextWindow } from "./context-window-builder/context-window.types.js";
